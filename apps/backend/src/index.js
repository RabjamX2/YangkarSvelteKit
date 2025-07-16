const express = require("express");
const bodyParser = require("body-parser");
const { register, login } = require("./auth");

const app = express();
app.use(bodyParser.json());

app.post("/register", register);
app.post("/login", login);

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
