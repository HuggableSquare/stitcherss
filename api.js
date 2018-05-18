'use strict';

const request = require('request-promise');
const { promisify } = require('util');
const parseString = promisify(require('xml2js').parseString);
const eol = require('eol');

// this is the same device id that the web app uses
const udid = 'aaaabbbbccccddddeeeeffffgggg';

const stitcher = request.defaults({
	baseUrl: 'https://app.stitcher.com/Service/',
	transform: (body) => parseString(body, { valueProcessors: [eol.lf] }),
	qs: {
		udid,
		sess: null,
		version: 3.07,
		mode: 'webApp',
		app_version: 1.3
	}
});

async function encryptPassword(password) {
	const res = await request.post('https://app.stitcher.com/Service/encryptPasswordJSON.php', {
		json: true,
		form: { udid, password }
	});

	return res[0];
}

async function CheckAuthentication(email, password) {
	const res = await stitcher('CheckAuthentication.php', {
		qs: { email, epx: await encryptPassword(password) }
	});

	return res.user.$;
}

async function GetFeedDetailsWithEpisodes(fid, uid, opts = {}) {
	const { seasonId, offset = 0 } = opts;

	// when requesting a season, the entire thing will be returned
	// so max_epi is only used when requesting a show without seasons
	// this is the same as how the webapp does it

	// technically this endpoint seems to accept any number for max_epi
	// I'm going to stick with 50 for now since that's what the webapp does
	const max_epi = seasonId ? undefined : 50; // eslint-disable-line camelcase

	const res = await stitcher('GetFeedDetailsWithEpisodes.php', {
		qs: { fid, uid, max_epi, s: offset, id_Season: seasonId }
	});

	const feed = res.feed_details.feed[0];
	const episodes = res.feed_details.episodes[0];
	return {
		details: Object.assign(feed.$, {
			name: feed.name[0],
			description: feed.description[0],
		}),
		seasons: feed.season ? feed.season.map((s) => s.$) : undefined,
		episodes: episodes.episode.map((e) => Object.assign(e.$, {
			title: e.title[0],
			description: e.description[0]
		}))
	};
}

async function Search(term, uid, offset = 0) {
	const res = await stitcher('Search.php', {
		qs: { term, uid, s: offset, c: 20 }
	});

	return {
		total: res.search.results[0].$.total,
		results: res.search.feed.map((f) => Object.assign(f.$, {
			name: f.name[0],
			description: f.description[0]
		}))
	};
}

module.exports = { CheckAuthentication, GetFeedDetailsWithEpisodes, Search };
