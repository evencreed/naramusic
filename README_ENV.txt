Local .env (create backend/.env)

PORT=4000
JWT_SECRET=change_me_local
# GOOGLE_API_KEY=your_google_key_optional
# FIREBASE_SERVICE_ACCOUNT can be raw JSON or base64-encoded JSON
# Example raw JSON:
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@...gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}

On Render: add the same variables in the Dashboard → Environment.

