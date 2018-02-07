const express = require('express');
const bodyParser = require('body-parser');
const RSS = require('rss');
const shortid = require('shortid');
const path = require('path');
const url = require('url');
const mime = require('mime-types');
const api = require('./api');
const utils = require('./utils');
const db = require('./db');

const app = express();
app.use(bodyParser.json());

// TODO: setup a real config
const config = {
	protocol: 'https://',
	port: 7824,
	domain: 'example.com:7824'
};

app.post('/login', async (req, res) => {
	try {
		const user = await api.CheckAuthentication(req.body.email, req.body.password);

		if (user.error) {
			return res.status(403).send(user.error);
		}

		if (user.subscriptionState !== '3') {
			return res.status(403).send('User is not a subscriber');
		}

		// if user already has generated ids don't overwrite them
		const record = await db.User.findById(user.id) || {};
		const authData = {
			rssUser: record.rssUser || shortid.generate(),
			rssPassword: record.rssPassword || shortid.generate()
		};

		await db.User.upsert(Object.assign(user, authData));
		return res.status(200).json(authData);
	} catch (e) {
		return res.status(500).send('Server error');
	}
});

app.get('/shows/:showId/feed', utils.basicAuth(), async (req, res) => {
	try {
		const data = await utils.getShowFeed(req.params.showId, req.user.id);

		const feed = new RSS({
			title: data.details.name,
			description: data.details.description,
			generator: 'stitcherss',
			feed_url: config.protocol + config.domain + req.originalUrl,
			site_url: `https://app.stitcher.com/browse/feed/${data.details.id}/details`,
			image_url: data.details.imageURL,
			pubDate: utils.pubDateFormat(data.details.published),
			custom_namespaces: {
				itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd'
			},
			custom_elements: [
				{ 'itunes:image': { _attr: { href: data.details.imageURL } } }
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
					url: `${config.protocol}${req.login.name}:${req.login.pass}@${config.domain}/shows/${req.params.showId}/episodes/${episode.id}/enclosure.mp3`,
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

app.get('/shows/:showId/episodes/:episodeId/enclosure.mp3', utils.basicAuth(), async (req, res) => {
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

app.listen(config.port);
