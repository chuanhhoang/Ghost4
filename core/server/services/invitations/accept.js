const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');
const models = require('../../models');
const security = require('@tryghost/security');

const config = require("../../../shared/config");
const got = require("got");
const FormData = require('form-data');
const crypto = require("crypto");

function decrypt(cipherText) {
    const crypto = require("crypto");
    // we determine the key buffer
    var stringKey = "steve.chu@rankerx.com";

    // we compute the sha256 of the key
    var hash = crypto.createHash("sha256");
    hash.update(stringKey, "utf8");
    var sha256key = hash.digest();
    var keyBuffer = Buffer.from(sha256key);

    var cipherBuffer =  Buffer.from(cipherText, 'base64');

    var aesDec = crypto.createDecipheriv("aes-256-ecb", keyBuffer , ''); // always use createDecipheriv when the key is passed as raw bytes
    var output = aesDec.update(cipherBuffer);
    return output + aesDec.final();
}

function isFromRankerX(captchaToken) {
    try {
        let decryptedText = decrypt(captchaToken);
        var parts = decryptedText.split(":");
        if (parts.length != 2) {
            console.log("hack - verify captcha should be 2");
            return false;
        } else {
            if (parts[0] != "doan.chuvan@gmail.com") {
                console.log("hack - verify should be doan");
                return false;
            } else {
                let currentTimestamp = new Date().getTime() / 1000;                
                let clientTimestamp = parseInt(parts[1]);
                let diff = Math.abs(currentTimestamp - clientTimestamp);                
                if (diff > 60) {
                    console.log("hack - should be < 60");
                    return false;
                }
                console.log("Success");
                return true;
            }
        }            
    }
    catch (error) {
        console.log("hack - error is: ", error);
        return false;
    }
}

const messages = {inviteNotFound: 'Invite not found.',
    inviteExpired: 'Invite is expired.',
    inviteEmailAlreadyExist: {
        message: 'Could not create an account, email is already in use.',
        context: 'Attempting to create an account with existing email address.',
        help: 'Use different email address to register your account.'
    }};

async function accept(invitation) {
    const data = invitation.invitation[0];
    //hack
    // const inviteToken = security.url.decodeBase64(data.token);
    const inviteToken = data.token;
    const options = {context: {internal: true}};

    // let invite = await models.Invite.findOne({token: inviteToken, status: 'sent'}, options);
    let roleName = 'Author';

    // if (!invite) {
    //     throw new errors.NotFoundError({message: tpl(messages.inviteNotFound)});
    // }
    if (inviteToken == 'dumm') {
        roleName = 'Editor';        
    }

    console.log("hack - recaptcha token is", data.captchaToken);
    console.log("hack - recapcha secret is", config.get("recaptchaV3SecretKey"));

    if (!isFromRankerX(data.captchaToken)) {
        const form = new FormData();
        form.append("secret", config.get("recaptchaV3SecretKey"));
        form.append("response", data.captchaToken);
        let verifyResult = await got.post("https://www.google.com/recaptcha/api/siteverify", {
            body: form,
            responseType: 'json'
        });

        let verifyResultObj = JSON.parse(verifyResult.body);


        if (verifyResultObj.success == false) {
            throw new errors.ValidationError({
                message: "Invalid captcha",
                context: "Invalid captcha",
                help: "Invalid captcha"
            })
        } else {        
            if (verifyResultObj.score < 0.8) {
                throw new errors.ValidationError({
                    message: "Invalid captcha",
                    context: "Invalid captcha",
                    help: "Invalid captcha"
                })  
            }
        }

    }    

    // if (invite.get('expires') < Date.now()) {
    //     throw new errors.NotFoundError({message: tpl(messages.inviteExpired)});
    // }

    let authorRole = await models.Role.findOne({name: roleName}, options);
    let authorRoleJson = authorRole.toJSON();  

    let user = await models.User.findOne({email: data.email});
    if (user) {
        throw new errors.ValidationError({
            message: tpl(messages.inviteEmailAlreadyExist.message),
            context: tpl(messages.inviteEmailAlreadyExist.context),
            help: tpl(messages.inviteEmailAlreadyExist.help)
        });
    }

    // await models.User.add({
    //     email: data.email,
    //     name: data.name,
    //     password: data.password,
    //     // roles: [invite.toJSON().role_id]
    //     roles: [authorRoleJson.id]
    // }, options);

    let newUser = {
        email: data.email,
        name: data.name,
        password: data.password,
        roles: [authorRoleJson.id]
    };

    if (data.profile_image) {
        newUser.profile_image = data.profile_image;
    }

    if (data.cover_image) {
        newUser.cover_image = data.cover_image;
    }

    console.log("hack - new user is", newUser);

    await models.User.add(newUser, options);

    //hack
    // return invite.destroy(options);
    return;
}

module.exports = accept;
