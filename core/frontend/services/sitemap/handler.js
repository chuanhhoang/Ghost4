const config = require('../../../shared/config');
const Manager = require('./manager');
const manager = new Manager();

// Responsible for handling requests for sitemap files
module.exports = function handler(siteApp) {
    const verifyResourceType = function verifyResourceType(req, res, next) {
        const resourceWithoutPage = req.params.resource.replace(/-\d+$/, '');
        if (!Object.prototype.hasOwnProperty.call(manager, resourceWithoutPage)) {
            return res.sendStatus(404);
        }

        next();
    };

    // siteApp.get('/sitemap.xml', function sitemapXML(req, res) {
    siteApp.get('/sitemap.xml', function sitemapXML(req, res, next) {
        res.set({
            'Cache-Control': 'public, max-age=' + config.get('caching:sitemap:maxAge'),
            'Content-Type': 'text/xml'
        });

        // res.send(manager.getIndexXml());
        let author = "";
        if (req.subdomains) {
            if (req.subdomains.length > 0) {
                author = req.subdomains[0];
            }
        }
        let result = manager.getIndexXml(author);
        res.send(result);        
    });

    siteApp.get('/sitemap-:resource.xml', verifyResourceType, async function sitemapResourceXML(req, res, next) {
        try {
            const type = req.params.resource;
            const page = 1;

            res.set({
                'Cache-Control': 'public, max-age=' + config.get('caching:sitemap:maxAge'),
                'Content-Type': 'text/xml'
            });

            let author = "";
            if (req.subdomains) {
                if (req.subdomains.length > 0) {
                    author = req.subdomains[0];
                }
            }

            let result = await manager.getSiteMapXml(type, author);
            res.send(result);
        }
        catch (error) {
            next(error);
        }
    });
};
