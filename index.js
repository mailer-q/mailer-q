const nodemailer = require("nodemailer");
const kue = require("kue");

const MailerQ = (config) => {
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure || false,
        auth: {
            user: config.auth.user,
            pass: config.auth.pass
        }
    });

    let mod = {};

    mod.contents = (message) => {
        const messagePayload = {
            from: message.from || config.defaultFrom,
            to: message.to || config.defaultTo,
            subject: message.subject,
            text: message.textBody,
            html: message.htmlBody
        };

        mod.messagePayload = messagePayload;

        return mod;
    }

    mod.deliverNow = () => {
        return new Promise((resolve, reject) => {
            transporter.sendMail(mod.messagePayload, (err) => {
                if (err) {
                    return reject(err);
                }

                resolve();
            });
        });
    }

    mod.deliverLater = () => {
        let redisConfig;

        if (config.redis) {
            redisConfig = {
                redis: config.redis
            }
        }

        const queue = kue.createQueue(redisConfig);

        return new Promise((resolve, reject) => {
            queue
            .create("SendEmail", mod.messagePayload)
            .save((err) => {
                if (err) {
                    return reject(err);
                }

                resolve();
            });

            queue.process("SendEmail", (job, done) => {
                job.attempts(5).backoff(true);

                transporter.sendMail(job.data, (err) => {
                    if (err) {
                        return done(err);
                    }

                    done();
                });
            });
        });
    }

    return mod;
}

module.exports = MailerQ;