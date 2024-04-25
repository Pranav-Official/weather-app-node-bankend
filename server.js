const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors(["localhost:4200"]));
const PORT = 3000;
// Setup------------------------------------------------------------------------------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "experion@123",
  database: "weather_app",
  timezone: "+00:00",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL");
});

app.use(bodyParser.json());

// Middleware to verify JWT token----------------------------------------------------------------
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ auth: false, message: "No token provided." });
  }
  jwt.verify(token, "secret_key", function (err, decoded) {
    if (err) {
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token." });
    }

    req.body.user_id = decoded.id;
    next();
  });
}

// Signup endpoint-------------------------------------------------------------------------------
app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  console.log(req.body);
  // Check if user already exists
  db.query("SELECT * FROM user WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Error executing MySQL query:", err);
      return res.status(500).send({ message: "Internal server error." });
    }
    if (results.length > 0) {
      return res
        .status(400)
        .send({ message: "User with email already exists." });
    }
    const uuid = uuidv4();
    db.query(
      "INSERT INTO user (id,username,email,password) VALUES (?,?, ?, ?)",
      [uuid, username, email, password],
      (err, results) => {
        if (err) {
          console.error("Error executing MySQL query:", err);
          return res.status(500).send({ message: "Internal server error." });
        }
        // Create a token for the new user
        const token = jwt.sign({ id: results.insertId }, "secret_key", {
          expiresIn: 86400,
        }); // expires in 24 hours
        res.status(200).send({ auth: true, username, token });
      }
    );
  });
});

// Login endpoint--------------------------------------------------------------------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SELECT * FROM user WHERE email = ? AND password = ?",
    [email, password],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res.status(500).send({ message: "Internal server error." });
      }
      if (results.length === 0) {
        return res.status(401).send({
          auth: false,
          token: null,
          message: "Invalid username or password.",
        });
      }
      // Create a token for the user
      const token = jwt.sign({ id: results[0].id }, "secret_key", {
        expiresIn: 86400,
      }); // expires in 24 hours
      res.status(200).send({ auth: true, token });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
