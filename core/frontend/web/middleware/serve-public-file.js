const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const errors = require('@tryghost/errors');
const config = require('../../../shared/config');
const urlUtils = require('../../../shared/url-utils');
const tpl = require('@tryghost/tpl');
const urlHandle = require("url");

const messages = {
    imageNotFound: 'Image not found',
    fileNotFound: 'File not found'
};

/**
 * If this request has a ?v= param, make sure the cache has the same key
 *
 * @param {Object} req
 * @param {Object} cache
 * @returns {boolean}
 */
function matchCacheKey(req, cache) {
    if (req.query && req.query.v && cache && cache.key) {
        return req.query.v === cache.key;
    }

    return true;
}

function createPublicFileMiddleware(location, file, mime, maxAge) {
    let cachedContent;

    let cache;
    // These files are provided by Ghost, and therefore live inside of the core folder
    const staticFilePath = config.get('paths').publicFilePath;
    // These files are built on the fly, and must be saved in the content folder
    const builtFilePath = config.getContentPath('public');

    let locationPath = location === 'static' ? staticFilePath : builtFilePath;

    const filePath = file.match(/^public/) ? path.join(locationPath, file.replace(/^public/, '')) : path.join(locationPath, file);
    const blogRegex = /(\{\{blog-url\}\})/g;

    return function servePublicFileMiddleware(req, res, next) {        
        if (cachedContent) {
            res.writeHead(200, cachedContent.headers);
            return res.end(cachedContent.body);
        }

        if (cache && matchCacheKey(req, cache)) {
            res.writeHead(200, cache.headers);
            return res.end(cache.body);
        }

        // send image files directly and let express handle content-length, etag, etc
        if (mime.match(/^image/)) {
            return res.sendFile(filePath, (err) => {
                if (err && err.status === 404) {
                    // ensure we're triggering basic asset 404 and not a templated 404
                    return next(new errors.NotFoundError({
                        message: tpl(messages.imageNotFound),
                        code: 'STATIC_FILE_NOT_FOUND',
                        property: err.path
                    }));
                }

                if (err) {
                    return next(err);
                }
            });
        }

        // modify text files before caching+serving to ensure URL placeholders are transformed
        fs.readFile(filePath, (err, buf) => {
            if (err) {
                // Downgrade to a simple 404 if the file didn't exist
                if (err.code === 'ENOENT') {
                    err = new errors.NotFoundError({
                        message: tpl(messages.fileNotFound),
                        code: 'PUBLIC_FILE_NOT_FOUND',
                        property: err.path
                    });
                }
                return next(err);
            }

            let str = buf.toString();

            if (mime === 'text/xsl' || mime === 'text/plain' || mime === 'application/javascript') {
                // str = str.replace(blogRegex, urlUtils.urlFor('home', true).replace(/\/$/, ''));
                console.log("hack - tao dang vao day ne");
                let blogUrl = urlUtils.urlFor('home', true);

                if (req.subdomains) {
                    if (req.subdomains.length > 0) {
                        let author = req.subdomains[0];
                        let urlObj = urlHandle.parse(blogUrl, true, true);
                        urlObj.hostname = author + "." + urlObj.hostname;
                        urlObj.host = author + "." + urlObj.host;
                        blogUrl = urlHandle.format(urlObj);
                    }
                }

                str = str.replace(blogRegex, blogUrl.replace(/\/$/, ''));                
            }

            cache = {
                headers: {
                    'Content-Type': mime,
                    'Content-Length': Buffer.from(str).length,
                    ETag: `"${crypto.createHash('md5').update(str, 'utf8').digest('hex')}"`,
                    'Cache-Control': `public, max-age=${maxAge}`
                },
                body: str,
                key: req.query && req.query.v ? req.query.v : null
            };

            if (filePath.indexOf("sitemap") == -1 && filePath.indexOf("robots.txt") == -1) {
                cachedContent = cache;
            }

            res.writeHead(200, cache.headers);
            res.end(cache.body);
        });
    };
}

// ### servePublicFile Middleware
// Handles requests to robots.txt and favicon.ico (and caches them)
function servePublicFile(location, file, type, maxAge) {
    const publicFileMiddleware = createPublicFileMiddleware(location, file, type, maxAge);

    return function servePublicFileMiddleware(req, res, next) {
        if (req.path === '/' + file) {
            return publicFileMiddleware(req, res, next);
        } else {
            return next();
        }
    };
}

module.exports = servePublicFile;
module.exports.servePublicFile = servePublicFile;
module.exports.createPublicFileMiddleware = createPublicFileMiddleware;
