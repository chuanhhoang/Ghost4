const urlUtils = require('../../../shared/url-utils');
let sitemapsUtils;

sitemapsUtils = {
    // getDeclarations: function () {
    //     let baseUrl = urlUtils.urlFor('sitemap_xsl', true);
    //     baseUrl = baseUrl.replace(/^(http:|https:)/, '');
    //     return '<?xml version="1.0" encoding="UTF-8"?>' +
    //         '<?xml-stylesheet type="text/xsl" href="' + baseUrl + '"?>';
    // }
    getDeclarations: function (subdomain) {
    	console.log("hack - getSiteMap getDeclarations", subdomain);
        let baseUrl = urlUtils.urlFor('sitemap_xsl', true);
        baseUrl = baseUrl.replace(/^(http:|https:)\/\//, '');
        if (subdomain) {
        	baseUrl = "//" + subdomain + "." + baseUrl;
        } else {
        	baseUrl = "//" + baseUrl;
        }
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<?xml-stylesheet type="text/xsl" href="' + baseUrl + '"?>';
    }    
};

module.exports = sitemapsUtils;
