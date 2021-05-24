const nodemailer = require("nodemailer");
const Queue = require("bull");

const MailerQ = () => {
  let mod = {};
  let config = {};

  mod.config = (configOptions) => {
    config = configOptions;

    return mod;
  };

  mod.contents = (message) => {
    const messagePayload = {
      from: message.from || config.defaultFrom,
      to: message.to || config.defaultTo,
      subject: message.subject,
      html: config.renderer
        ? config.renderer(message.templateFileName, message.locals)
        : message.htmlBody,
    };

    mod.messagePayload = messagePayload;

    return mod;
  };

  mod.deliverNow = () => {
    const transporter = nodemailer.createTransport(config.nodemailerConfig);

    return new Promise((resolve, reject) => {
      transporter.sendMail(mod.messagePayload, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  };

  mod.deliverLater = () => {
    let redisConfig;

    if (config.redis) {
      redisConfig = {
        redis: config.redis,
      };
    }

    const queue = new Queue("MailerQ SendEmail Process", redisConfig);

    const transporter = nodemailer.createTransport(config.nodemailerConfig);

    return new Promise((resolve, reject) => {
      queue.process((job, done) => {
        transporter.sendMail(job.data, (err) => {
          if (err) {
            done(err);

            return reject(err);
          }

          done();

          return resolve();
        });
      });
    });
  };

  return mod;
};

module.exports = MailerQ;
