module.exports = ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET", "adminJwtSecret")
  },
  apiToken: {
    salt: env("API_TOKEN_SALT", "apiTokenSalt")
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT", "transferTokenSalt")
    }
  }
});
