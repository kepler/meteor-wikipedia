Package.describe({
    name: 'kepler:wikipedia',
    summary: 'Fetch the content of a Wikipedia page.',
    version: '0.0.1',
    git: 'https://github.com/kepler/meteor-wikipedia.git'
});

Npm.depends({
    "cheerio": "0.19.0",
    "request": "2.57.0",
    "nlp_compromise": "1.1.2"
});

Package.onUse(function (api) {
    api.versionsFrom('1.0');
    api.use('underscore', 'server');
    api.add_files('server/lib/wikipedia.js', 'server');
    api.export && api.export('Wikipedia', 'server');
});
