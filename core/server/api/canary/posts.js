const models = require('../../models');
const tpl = require('@tryghost/tpl');
const errors = require('@tryghost/errors');
const getPostServiceInstance = require('../../services/posts/posts-service');
const allowedIncludes = ['tags', 'authors', 'authors.roles', 'email', 'tiers'];
const unsafeAttrs = ['status', 'authors', 'visibility'];

const messages = {
    postNotFound: 'Post not found.'
};

const postsService = getPostServiceInstance('canary');

module.exports = {
    docName: 'posts',
    browse: {
        options: [
            'include',
            'filter',
            'fields',
            'formats',
            'limit',
            'order',
            'page',
            'debug',
            'absolute_urls'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                formats: {
                    values: models.Post.allowedFormats
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            //hack
            //We don't allow to display posts for multile users at a same time because we have millions users
            if (frame.options.filter && (frame.options.filter.indexOf("authors:[") != -1)) {
                return null;
            }
            if (frame.user && frame.user.attributes && frame.user.attributes.slug) {
                if (frame.options.filter) {                   
                    if (frame.options.filter.indexOf("authors:") != -1) {
                        if (frame.options.filter.indexOf("authors:" + frame.user.attributes.slug) == -1) {
                            return null;
                        }
                    } else {
                        frame.options.filter = "authors:" + frame.user.attributes.slug;
                    }
                } else {
                    frame.options.filter = "authors:" + frame.user.attributes.slug;
                }
            } else {
                return null;
            }
                        
            return models.Post.findPage(frame.options);
        }
    },

    read: {
        options: [
            'include',
            'fields',
            'formats',
            'debug',
            'absolute_urls',
            // NOTE: only for internal context
            'forUpdate',
            'transacting'
        ],
        data: [
            'id',
            'slug',
            'uuid'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                formats: {
                    values: models.Post.allowedFormats
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            return models.Post.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        throw new errors.NotFoundError({
                            message: tpl(messages.postNotFound)
                        });
                    }

                    return model;
                });
        }
    },

    add: {
        statusCode: 201,
        headers: {},
        options: [
            'include',
            'formats',
            'source'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                source: {
                    values: ['html']
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            return models.Post.add(frame.data.posts[0], frame.options)
                .then((model) => {
                    if (model.get('status') !== 'published') {
                        this.headers.cacheInvalidate = false;
                    } else {
                        this.headers.cacheInvalidate = true;
                    }

                    return model;
                });
        }
    },

    edit: {
        headers: {},
        options: [
            'include',
            'id',
            'formats',
            'source',
            'email_recipient_filter',
            'newsletter_id',
            'send_email_when_published',
            'force_rerender',
            // NOTE: only for internal context
            'forUpdate',
            'transacting'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                id: {
                    required: true
                },
                source: {
                    values: ['html']
                },
                send_email_when_published: {
                    values: [true, false]
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        async query(frame) {
            //hack
            //We only allow to submit posts with exiting tags
            let submittedTags = frame.data.posts[0].tags;
            submittedTags = frame.data.posts[0].tags.filter((tag) => {
                return tag.id;
            })

            frame.data.posts[0].tags = submittedTags;

            let model = await postsService.editPost(frame);

            this.headers.cacheInvalidate = postsService.handleCacheInvalidation(model);

            return model;
        }
    },

    destroy: {
        statusCode: 204,
        headers: {
            cacheInvalidate: true
        },
        options: [
            'include',
            'id'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                id: {
                    required: true
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            frame.options.require = true;

            return models.Post.destroy(frame.options)
                .then(() => null)
                .catch(models.Post.NotFoundError, () => {
                    return Promise.reject(new errors.NotFoundError({
                        message: tpl(messages.postNotFound)
                    }));
                });
        }
    }
};
