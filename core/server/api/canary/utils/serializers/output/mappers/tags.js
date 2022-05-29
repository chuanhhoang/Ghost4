const clean = require('../utils/clean');
const url = require('../utils/url');

module.exports = (model, frame) => {
    const jsonModel = model.toJSON ? model.toJSON(frame.options) : model;

    //hack
    // url.forTag(model.id, jsonModel, frame.options);
    url.forTagWithData(model, jsonModel, frame.options);
    
    clean.tag(jsonModel, frame);

    return jsonModel;
};
