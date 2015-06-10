//Meteor.npmRequire = function(moduleName) {
//    var module = Npm.require(moduleName);
//    return module;
//};


var cheerio = Npm.require('cheerio'),
    request = Npm.require('request'),
    nlp = Npm.require('nlp_compromise');

Wikipedia = function (params) {
    options = _.chain(params).pick(
        'articlePrefix',
        'removeFootnotes',
        'joinParagraphs',
        'replaceInternalLinks',
        'segmentSentences'
    ).defaults({
            articlePrefix: 'http://en.wikipedia.org/wiki/',
            removeFootnotes: true,
            joinParagraphs: true,
            replaceInternalLinks: false,
            segmentSentences: false
        }).value();
    _.extend(this, options);
};

Wikipedia.prototype.fetch = function (articleName, callback) {
    var _this = this;

    this.loadArticle(articleName, function (err, article) {
        if (err) {
            callback(err, null);
            return;
        }
        parsedArticle = {};
        _this.parseTitle(article, parsedArticle);
        _this.parseLinks(article, parsedArticle);
        _this.parseSections(article, parsedArticle);
        _this.parseText(parsedArticle);
        callback(null, parsedArticle);
    });
};

Wikipedia.prototype.parseTitle = function (article, parsedArticle) {
    parsedArticle.title = article('#firstHeading').text();
};

Wikipedia.prototype.parseLinks = function (article, parsedArticle) {

    parsedArticle.links = {};

    article('#bodyContent p a').each(function () {
        var element = cheerio(this),
            href = element.attr('href'),
            entityName = href.replace('/wiki/', '');

        // Only extract article links.
        if (href.indexOf('/wiki/') < 0) return;

        // Create or update the link lookup table.
        if (parsedArticle.links[entityName]) {
            parsedArticle.links[entityName].occurrences++;
        } else {
            parsedArticle.links[href.replace('/wiki/', '')] = {
                title: element.attr('title'),
                occurrences: 1,
                text: element.text()
            };
        }

        // Replace the element in the page with a reference to the link.
        element.replaceWith('[[' + entityName + ']]');
    });
};

Wikipedia.prototype.parseSections = function (article, parsedArticle) {
    var currentHeadline = parsedArticle.title;

    parsedArticle.sections = {};

    article('#bodyContent p,h2,h3,img').each(function () {
        var element = cheerio(this);

        // Load new headlines as we observe them.
        if (element.is('h2') || element.is('h3')) {
            currentHeadline = element.text().trim();
            return;
        }

        // Initialize the object for this section.
        if (!parsedArticle.sections[currentHeadline]) {
            parsedArticle.sections[currentHeadline] = {
                text: [],
                images: []
            };
        }

        // Grab images from the section don't grab spammy ones.
        if (element.is('img') && element.attr('width') > 50) {
            parsedArticle.sections[currentHeadline].images.push(element.attr('src').replace('//', 'http://'));
            return;
        }

        if (element.text().trim().length > 0) {
            parsedArticle.sections[currentHeadline].text.push(element.text().trim());
        }
    });
};

Wikipedia.prototype.parseText = function (parsedArticle) {
    var self = this;
    var articleText = [];
    var articleSentences = [];
    _.each(parsedArticle.sections, function (val, key) {
        var text = _.map(
            _.filter(_.pick(val, 'text'), function (t) {
                return !_.isEmpty(t);
            }),
            function (val2) {
                //console.log("text:", key, val2);
                var text = val2;
                if (self.replaceInternalLinks) {
                    text = _.map(text, function (el) {
                        return el.replace(/\[\[([^\]]+?)\]\]/gm, function (match, p1) {
                            return (parsedArticle.links[p1] && parsedArticle.links[p1].text) || p1;
                        }); // Replace internal links with the corresponding text
                    });
                }
                if (self.removeFootnotes) {
                    text = _.map(text, function (el) {
                        return el.replace(/([^\[]|^)\[(nt )?\d+](?! ])/g, '$1'); //Remove reference tags (e.x. [1], [4], [nt 1], etc)
                    });
                }
                if (self.segmentSentences) {
                    articleSentences.push(_.map(text, function (par) {
                        return nlp.sentences(par);
                    }));
                }
                if (self.joinParagraphs) {
                    text = text.join('\n');
                }
                return text;
            });
        parsedArticle.sections[key].text = text;
        //articleText.push(key);
        articleText.push(text);
    });
    parsedArticle.text = articleText.join('\n');
    parsedArticle.sentences = _.flatten(articleSentences);
};

Wikipedia.prototype.loadArticle = function (articleName, callback) {
    request({
        url: this.articlePrefix + articleName
    }, function (err, res, body) {
        var error = err || (res.statusCode != 200 ? res.statusCode : false);
        if (error) {
            callback(error, null);
            return;
        }
        callback(null, cheerio.load(body));
    });
};
