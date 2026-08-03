const router = require("express").Router();
const { suscribirNewsletter } = require("../controllers/newsletterController");

router.post("/", suscribirNewsletter);

module.exports = router;
