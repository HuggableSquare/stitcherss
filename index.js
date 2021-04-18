'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const RSS = require('rss');
const uuid = require('uuid');
const path = require('path');
const url = require('url');
const mime = require('mime-types');
const config = require('config');
const api = require('./api');
const utils = require('./utils');
const db = require('./db');

const app = express();
app.use(bodyParser.json());

app.post('/login', utils.stitcherAuth(), async (req, res) => {
	try {
		if (config.whitelist && !config.whitelist.includes(req.user.id)) {
			throw new Error(`user not on whitelist: ${req.user.id}`);
		}

		// if user already has generated ids don't overwrite them
		const record = await db.User.findById(req.user.id) || {};
		const authData = { token: record.token || uuid.v4() };

		await db.User.upsert(Object.assign(req.user, authData));
		return res.status(200).json(authData);
	} catch (e) {
		return res.status(500).send(e.message);
	}
});

app.post('/reset-token', utils.stitcherAuth(), async (req, res) => {
	try {
		const record = await db.User.findById(req.user.id);
		if (!record) {
			return res.status(400).send('User has not logged in previously');
		}

		record.set('token', uuid.v4());
		await record.save();
		return res.status(200).json({ token: record.token });
	} catch (e) {
		return res.status(500).send('Server error');
	}
});

app.get('/search', utils.tokenAuth(), async (req, res) => {
	try {
		const results = await api.Search(req.query.term, req.user.id, req.query.offset);
		return res.status(200).json(results);
	} catch (e) {
		console.log(e);
		return res.status(500).send('Server error');
	}
});

app.get('/shows/:showId/feed', utils.tokenAuth(), async (req, res) => {
	try {
		const data = await utils.getShowFeed(req.params.showId, req.user.id);

		const feed = new RSS({
			title: data.details.name,
			description: data.details.description,
			generator: 'stitcherss',
			feed_url: `${config.protocol}://${config.domain}${req.originalUrl}`,
			site_url: `https://app.stitcher.com/browse/feed/${data.details.id}/details`,
			image_url: data.details.imageURL,
			pubDate: utils.pubDateFormat(data.details.published),
			custom_namespaces: {
				itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd'
			},
			custom_elements: [
				{ 'itunes:image': { _attr: { href: data.details.imageURL } } },
				{ 'itunes:author': 'Stitcher Premium' }
			]
		});

		data.episodes.forEach((episode) => {
			feed.item({
				title: episode.title,
				description: episode.description,
				guid: episode.id,
				date: utils.pubDateFormat(episode.published),
				enclosure: {
					// TODO: make this less gross maybe?
					// eslint-disable-next-line max-len
					url: `${config.protocol}://${config.domain}/shows/${req.params.showId}/episodes/${episode.id}/enclosure?token=${req.query.token}`,
					type: mime.lookup(path.extname(url.parse(episode.url).pathname))
				},
				custom_elements: [
					{ 'itunes:image': { _attr: { href: episode.episodeImage } } },
					{ 'itunes:duration': utils.durationFormat(episode.duration) }
				]
			});
		});

		res.type('text/xml');
		res.send(feed.xml());
	} catch (e) {
		return res.status(500).send('Server error');
	}
});

app.get('/shows/:showId/episodes/:episodeId/enclosure', utils.tokenAuth(), async (req, res) => {
	try {
		const feed = await utils.getShowFeed(req.params.showId, req.user.id);
		const episode = feed.episodes.find((e) => e.id === req.params.episodeId);
		if (!episode) {
			return res.status(404).send('Episode not found');
		}
		return res.redirect(episode.url);
	} catch (e) {
		return res.status(500).send('Server error');
	}
});

app.listen(config.port, config.host);

module.exports = app;
