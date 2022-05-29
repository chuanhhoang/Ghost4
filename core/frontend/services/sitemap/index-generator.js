const _ = require('lodash');
const xml = require('xml');
const moment = require('moment');
const urlUtils = require('../../../shared/url-utils');
const localUtils = require('./utils');
const urlHandle = require('url');

const XMLNS_DECLS = {
    _attr: {
        xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
    }
};

class SiteMapIndexGenerator {
    constructor(options) {
        options = options || {};
        this.types = options.types;
        this.maxPerPage = options.maxPerPage;
    }

    getXml(author) {
        const urlElements = this.generateSiteMapUrlElements(author);

        const data = {
            // Concat the elements to the _attr declaration
            sitemapindex: [XMLNS_DECLS].concat(urlElements)
        };

        // Return the xml
        return localUtils.getDeclarations(author) + xml(data);
    }

    generateSiteMapUrlElements(author) {
        return _.map(_.filter(this.types, (resourceType) => {
            if (author) {
                if (resourceType.name == "pages" || resourceType.name == "authors" || resourceType.name == "tags") {
                    return false;
                }
            }
            return true;
        }), (resourceType) => {
            let url = urlUtils.urlFor({relativeUrl: '/sitemap-' + resourceType.name + '.xml'}, true);

            if (author) {
                let urlObj = urlHandle.parse(url, true, true);
                urlObj.hostname = author + "." + urlObj.hostname;
                urlObj.host = author + "." + urlObj.host;
                url = urlHandle.format(urlObj);
            }

            const lastModified = resourceType.lastModified;

            return {
                sitemap: [
                    {loc: url},
                    {lastmod: moment(lastModified).toISOString()}
                ]
            };
        });
    }
}

module.exports = SiteMapIndexGenerator;
