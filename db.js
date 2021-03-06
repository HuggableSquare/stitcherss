'use strict';

const Sequelize = require('sequelize');
const config = require('config');

const sequelize = new Sequelize(config.database);

// xml parser turns everything into strings
const User = sequelize.define('user', {
	id: { type: Sequelize.STRING, primaryKey: true },
	email: { type: Sequelize.STRING },
	phone: { type: Sequelize.STRING },
	optin: { type: Sequelize.STRING },
	explicit: { type: Sequelize.STRING },
	favorites_list_count: { type: Sequelize.STRING },
	unheard_favorites: { type: Sequelize.STRING },
	shares: { type: Sequelize.STRING },
	episodeCount: { type: Sequelize.STRING },
	totalListeningSeconds: { type: Sequelize.STRING },
	facebookShareEnabled: { type: Sequelize.STRING },
	shareListenFB: { type: Sequelize.STRING },
	shareThumbsFB: { type: Sequelize.STRING },
	shareFavsFB: { type: Sequelize.STRING },
	numNewFriends: { type: Sequelize.STRING },
	forceFavoritesWizard: { type: Sequelize.STRING },
	defaultLaunchPage: { type: Sequelize.STRING },
	subscriptionState: { type: Sequelize.STRING },
	subscriptionExpiration: { type: Sequelize.STRING },
	subscriptionPlatform: { type: Sequelize.STRING },
	token: { type: Sequelize.UUID, unique: true }
});

module.exports = { sequelize, User };
