'use strict';

const api = require('./api');
const { DateTime } = require('luxon');
const auth = require('basic-auth');
const db = require('./db');
const cache = require('memory-cache');

function pubDateParse(published) {
	// stitcher returns dates in the LA tz AFAICT
	return DateTime.fromSQL(published, { zone: 'America/Los_Angeles' });
}

function durationFormat(seconds) {
	seconds = Number(seconds);
	const HH = Math.floor(seconds / 3600).toString().padStart(2, '0');
	const MM = Math.floor(seconds % 3600 / 60).toString().padStart(2, '0');
	const SS = Math.floor(seconds % 3600 % 60).toString().padStart(2, '0');
	return `${HH}:${MM}:${SS}`;
}

function pubDateFormat(published) {
	return pubDateParse(published).toISO();
}

async function getShowFeed(showId, userId) {
	const cachedFeed = cache.get(showId);
	if (cachedFeed) {
		return cachedFeed;
	}

	const feed = await api.GetFeedDetailsWithEpisodes(showId, userId);

	if (feed.seasons) {
		feed.episodes = [];
		await Promise.all(feed.seasons.map(async (season) => {
			const tmp = await api.GetFeedDetailsWithEpisodes(showId, userId, { seasonId: season.id });
			feed.episodes = feed.episodes.concat(tmp.episodes);
		}));

		// sort feed by pubDate
		feed.episodes.sort((a, b) => {
			if (a.published !== b.published) {
				return a.published < b.published ? 1 : -1;
			}
			return 0;
		});
	} else if (feed.details.episodeCount > feed.episodes.length) {
		// note: episodeCount is completely wrong if the show has seasons
		let offset = 50;
		while (feed.details.episodeCount > feed.episodes.length) {
			const tmp = await api.GetFeedDetailsWithEpisodes(showId, userId, { offset });
			feed.episodes = feed.episodes.concat(tmp.episodes);
			// magic numbers REEEEEE
			offset += 50;
		}
	}

	// stick feed in cache for 30 minutes
	cache.put(showId, feed, 1800000);

	return feed;
}

function basicAuth() {
	// there's a weird bug with gpodder where it sends user/pass in all lowercase
	// when trying to download an episode ¯\_(ツ)_/¯
	return async function(req, res, next) {
		try {
			const login = auth(req);
			if (!login) {
				res.set('WWW-Authenticate', 'Basic realm="stitcherss"');
				return res.status(401).send('Access denied');
			}

			const user = await db.User.findOne({ where: { rssUser: login.name, rssPassword: login.pass } });
			if (!user) {
				return res.status(403).send('User/pass incorrect');
			}

			req.login = login;
			req.user = user;
			return next();
		} catch (e) {
			return res.status(500).send('Server error');
		}
	};
}

module.exports = { durationFormat, pubDateFormat, getShowFeed, basicAuth };
