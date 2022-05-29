const clean = require('../utils/clean');
const url = require('../utils/url');

module.exports = (model, frame) => {
    const jsonModel = model.toJSON ? model.toJSON(frame.options) : model;

    //hack
    // url.forUser(model.id, jsonModel, frame.options);
    url.forUserWithData(model, jsonModel, frame.options);

    clean.author(jsonModel, frame);

    return jsonModel;
};
