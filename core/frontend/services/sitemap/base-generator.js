const _ = require('lodash');
const xml = require('xml');
const moment = require('moment');
const path = require('path');
const urlUtils = require('../../../shared/url-utils');
const localUtils = require('./utils');
const models = require('../../../server/models');
const urlService = require('../url');
const urlHandle = require('url');

// Sitemap specific xml namespace declarations that should not change
const XMLNS_DECLS = {
    _attr: {
        xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
        'xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1'
    }
};

class BaseSiteMapGenerator {
    constructor() {
        this.nodeLookup = {};
        this.nodeTimeLookup = {};
        // this.siteMapContent = new Map();
        this.siteMapContent = null;
        this.lastModified = 0;
        this.maxPerPage = 50000;
    }

    // generateXmlFromNodes(page) {
    //     // Get a mapping of node to timestamp
    //     let nodesToProcess = _.map(this.nodeLookup, (node, id) => {
    //         return {
    //             id: id,
    //             // Using negative here to sort newest to oldest
    //             ts: -(this.nodeTimeLookup[id] || 0),
    //             node: node
    //         };
    //     });

    //     // Sort nodes by timestamp
    //     nodesToProcess = _.sortBy(nodesToProcess, 'ts');

    //     // Get the page of nodes that was requested
    //     nodesToProcess = nodesToProcess.slice((page - 1) * this.maxPerPage, page * this.maxPerPage);

    //     // Do not generate empty sitemaps
    //     if (nodesToProcess.length === 0) {
    //         return null;
    //     }

    //     // Grab just the nodes
    //     const nodes = _.map(nodesToProcess, 'node');

    //     const data = {
    //         // Concat the elements to the _attr declaration
    //         urlset: [XMLNS_DECLS].concat(nodes)
    //     };

    //     // Generate full xml
    //     let sitemapXml = localUtils.getDeclarations() + xml(data);

    //     // Perform url transformatons
    //     // - Necessary because sitemap data is supplied by the router which
    //     //   uses knex directly bypassing model-layer attribute transforms
    //     sitemapXml = urlUtils.transformReadyToAbsolute(sitemapXml);

    //     return sitemapXml;
    // }

    async generateXmlFromNodes(author) {
        if (this.name == "posts") {
            console.log("hack author is ", author);
            let filter = 'featured:true+status:published+type:post';

            let user = null;
            if (author) {
                let user = await models.User.findOne({slug: author});

                if (user) {
                    console.log("hack - we use author");
                    filter = 'author_id:' + user.id + '+status:published+type:post';
                } else {
                    console.log("hack - we don't use author");
                }
             }

            let modelOptions = {
                  modelName: 'Post',
                  filter: filter,
                  exclude: [
                    'title',               'mobiledoc',
                    'html',                'plaintext',
                    'status',              'amp',
                    'codeinjection_head',  'codeinjection_foot',
                    'meta_title',          'meta_description',
                    'custom_excerpt',      'og_image',
                    'og_title',            'og_description',
                    'twitter_image',       'twitter_title',
                    'twitter_description', 'custom_template',
                    'locale'
                  ]
            };


            let posts = await models.Base.Model.raw_knex.fetchAll(modelOptions);
            posts = posts.map((post) => {
                if (author) {
                    post.primary_author = {
                        slug: author
                    }
                }
                post.url = urlService.getUrlByResource(post, "posts", { absolute: true });
                return post;
            })
            let nodes = posts.map((post) => {
                return {
                    url: [
                        {
                            loc: post.url
                        },
                        {
                            lastmod: moment(this.getLastModifiedForDatum(post)).toISOString()
                        }
                    ]
                }
            });


            const data = {
                // Concat the elements to the _attr declaration
                urlset: [XMLNS_DECLS].concat(nodes)
            };

            // Generate full xml
            let sitemapXml = localUtils.getDeclarations(author) + xml(data);
            console.log("hack sitemap content is", sitemapXml);

            // Perform url transformatons
            // - Necessary because sitemap data is supplied by the router which
            //   uses knex directly bypassing model-layer attribute transforms
            sitemapXml = urlUtils.transformReadyToAbsolute(sitemapXml);
            return sitemapXml;
        }
        const self = this;

        // Get a mapping of node to timestamp
        const timedNodes = _.map(this.nodeLookup, function (node, id) {
            return {
                id: id,
                // Using negative here to sort newest to oldest
                ts: -(self.nodeTimeLookup[id] || 0),
                node: node
            };
        }, []);

        console.log("hack - timedNode is", timedNodes);

        // Sort nodes by timestamp
        const sortedNodes = _.sortBy(timedNodes, 'ts');

        // Grab just the nodes
        const urlElements = _.map(sortedNodes, 'node');


        const data = {
            // Concat the elements to the _attr declaration
            urlset: [XMLNS_DECLS].concat(urlElements)
        };

        // Generate full xml
        let sitemapXml = localUtils.getDeclarations(author) + xml(data);

        // Perform url transformatons
        // - Necessary because sitemap data is supplied by the router which
        //   uses knex directly bypassing model-layer attribute transforms
        sitemapXml = urlUtils.transformReadyToAbsolute(sitemapXml);
        return sitemapXml;
    }    

    addUrl(url, datum) {
        const node = this.createUrlNodeFromDatum(url, datum);

        if (node) {
            this.updateLastModified(datum);
            this.updateLookups(datum, node);
            // force regeneration of xml
            this.siteMapContent = null;
        }
    }

    removeUrl(url, datum) {
        this.removeFromLookups(datum);

        // force regeneration of xml
        // this.siteMapContent.clear();
        this.siteMapContent = null;
        this.lastModified = Date.now();
    }

    getLastModifiedForDatum(datum) {
        if (datum.updated_at || datum.published_at || datum.created_at) {
            const modifiedDate = datum.updated_at || datum.published_at || datum.created_at;

            return moment(modifiedDate);
        } else {
            return moment();
        }
    }

    updateLastModified(datum) {
        const lastModified = this.getLastModifiedForDatum(datum);

        if (lastModified > this.lastModified) {
            this.lastModified = lastModified;
        }
    }

    createUrlNodeFromDatum(url, datum) {
        let node;
        let imgNode;

        node = {
            url: [
                {loc: url},
                {lastmod: moment(this.getLastModifiedForDatum(datum)).toISOString()}
            ]
        };

        imgNode = this.createImageNodeFromDatum(datum);

        if (imgNode) {
            node.url.push(imgNode);
        }

        return node;
    }

    createImageNodeFromDatum(datum) {
        // Check for cover first because user has cover but the rest only have image
        const image = datum.cover_image || datum.profile_image || datum.feature_image;

        let imageUrl;
        let imageEl;

        if (!image) {
            return;
        }

        // Grab the image url
        imageUrl = urlUtils.urlFor('image', {image: image}, true);

        // Verify the url structure
        if (!this.validateImageUrl(imageUrl)) {
            return;
        }

        // Create the weird xml node syntax structure that is expected
        imageEl = [
            {'image:loc': imageUrl},
            {'image:caption': path.basename(imageUrl)}
        ];

        // Return the node to be added to the url xml node
        return {
            'image:image': imageEl
        };
    }

    validateImageUrl(imageUrl) {
        return !!imageUrl;
    }

    // getXml(page = 1) {
    //     if (this.siteMapContent.has(page)) {
    //         return this.siteMapContent.get(page);
    //     }

    //     const content = this.generateXmlFromNodes(page);
    //     this.siteMapContent.set(page, content);
    //     return content;
    // }

    async getXml(author) {
        // if (this.siteMapContent) {
        //     return this.siteMapContent;
        // }
        console.log("hack - getXML author", author);
        const content = this.generateXmlFromNodes(author);
        this.siteMapContent = content;
        return content;
    }

    /**
     * @NOTE
     * The url service currently has no url update event.
     * It removes and adds the url. If the url service extends it's
     * feature set, we can detect if a node has changed.
     */
    updateLookups(datum, node) {
        this.nodeLookup[datum.id] = node;
        this.nodeTimeLookup[datum.id] = this.getLastModifiedForDatum(datum);
    }

    removeFromLookups(datum) {
        delete this.nodeLookup[datum.id];
        delete this.nodeTimeLookup[datum.id];
    }

    reset() {
        this.nodeLookup = {};
        this.nodeTimeLookup = {};
        this.siteMapContent = null;
    }
}

module.exports = BaseSiteMapGenerator;
