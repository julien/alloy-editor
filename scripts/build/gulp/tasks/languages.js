'use strict';

const Constants = require('../constants');
const fs = require('fs');
const gulp = require('gulp');
const path = require('path');
const walk = require('walk');

const langWhitelist = /^[\w-]+\.js/;

/**
 * Normalizes the different string values that can be stored in a language template.
 * @param  {String} value The stored value
 * @param  {String} lang  The language in which we want the value to be resolved
 * @return {String} The normalized string
 */
const getStringLangValue = function(value, lang) {
	if (value.indexOf('.') !== -1) {
		value = 'CKEDITOR.lang["' + lang + '"].' + value.replace(/"/g, '');
	}

	// Value can be at this point a string 'value' or a reference to a CKEDITOR lang property
	// 'CKEDITOR.lang['en'].table'. Eval will, in both cases, resolve the proper value.
	return eval(value);
};

function buildLanguages(callback) {
	// Mock the CKEDITOR.lang object to walk the ckeditor js lang files
	global.CKEDITOR = {
		lang: {},
	};

	// Mock AlloyEditor
	global.AlloyEditor = {
		Strings: {},
	};

	const langWalker = walk.walk(Constants.srcLangDir);
	langWalker.on('end', () => callback());

	const defaultTranslations = require(path.join(
		Constants.langDir,
		'language.json'
	));

	// Iterate over every existing lang file inside src/__generated__/lang
	langWalker.on('file', (root, fileStats, next) => {
		if (!langWhitelist.test(fileStats.name)) {
			next();

			return;
		}

		const lang = path.basename(fileStats.name, '.js');

		// Load the matching CKEDITOR lang file with all the strings
		require(path.join(Constants.rootDir, 'lib', 'lang', fileStats.name));

		Object.keys(Constants.ckeditorLangContent).forEach(key => {
			AlloyEditor.Strings[key] = getStringLangValue(
				Constants.ckeditorLangContent[key],
				lang
			);
		});

		// Try to load translations for "lang"
		let translations;
		try {
			translations = require(path.join(
				Constants.langDir,
				lang + '.json'
			));
		} catch (err) {
			console.log('translations not found for:', lang);
		}

		if (translations) {
			Object.keys(defaultTranslations).forEach(key => {
				AlloyEditor.Strings[key] = defaultTranslations[key];
			});

			Object.keys(translations).forEach(key => {
				AlloyEditor.Strings[key] = translations[key];
			});
		}

		// Update the contents of the current lang file
		const assetFile = path.join(
			'src',
			'assets',
			'lang',
			path.basename(fileStats.name, '.js') + '.json'
		);
		const header =
			`/**\n` +
			` * THIS FILE IS AUTOGENERATED. DO NOT EDIT.\n` +
			` *\n` +
			` * See ${assetFile} instead.\n` +
			` */\n` +
			`\n`;
		fs.writeFile(
			path.join(
				Constants.rootDir,
				'src',
				'__generated__',
				'lang',
				fileStats.name
			),
			header +
				`AlloyEditor.Strings = ` +
				JSON.stringify(AlloyEditor.Strings, null, 2).replace(
					/^  /gm,
					'\t'
				) +
				';',
			err => {
				if (err) {
					return callback(err);
				}
				next();
			}
		);
	});
}

function copyLanguages() {
	return gulp
		.src(
			path.join(Constants.rootDir, 'src', '__generated__', 'lang', '/**')
		)
		.pipe(
			gulp.dest(
				path.join(Constants.editorDistFolder, 'lang', 'alloy-editor')
			)
		);
}

gulp.task('languages:copy', gulp.series(buildLanguages, copyLanguages));
