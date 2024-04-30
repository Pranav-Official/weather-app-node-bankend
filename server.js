const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(cors(["localhost:4200"]));
const PORT = 3000;
// Setup------------------------------------------------------------------------------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: process.env.SQL_PASSWORD,
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
    return res
      .status(401)
      .send({ status: false, message: "No token provided." });
  }
  jwt.verify(token, "secret_key", function (err, decoded) {
    if (err) {
      return res
        .status(500)
        .send({ status: false, message: "Failed to authenticate token." });
    }

    req.body.id = decoded.id;
    req.query.id = decoded.id;
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
      return res
        .status(500)
        .send({ status: false, message: "Internal server error." });
    }
    if (results.length > 0) {
      return res
        .status(400)
        .send({ status: false, message: "User with email already exists." });
    }
    const uuid = uuidv4();
    db.query(
      "INSERT INTO user (id,username,email,password) VALUES (?,?, ?, ?)",
      [uuid, username, email, password],
      (err, results) => {
        if (err) {
          console.error("Error executing MySQL query:", err);
          return res
            .status(500)
            .send({ status: false, message: "Internal server error." });
        }
        // Create a token for the new user
        const token = jwt.sign({ id: uuid }, "secret_key", {
          expiresIn: 86400,
        }); // expires in 24 hours
        res.status(200).send({
          status: true,
          message: "User created successfully",
          data: { username, token },
        });
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
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      if (results.length === 0) {
        return res.status(401).send({
          status: false,
          message: "Invalid email or password.",
          data: null,
        });
      }
      // Create a token for the user
      const token = jwt.sign({ id: results[0].id }, "secret_key", {
        expiresIn: 86400,
      }); // expires in 24 hours
      res.status(200).send({
        status: true,
        message: "User logged in successfully",
        data: { username: results[0].username, token },
      });
    }
  );
});

// Settings endpoint-----------------------------------------------------------------------------
app.patch("/settings", verifyToken, (req, res) => {
  const updates = req.body;
  const userId = updates.id;
  delete updates.id;
  const setClause = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(", ");
  db.query(
    `UPDATE user SET ${setClause} WHERE id = ?`,
    [...Object.values(updates), userId],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      res
        .status(200)
        .send({ status: true, message: "Settings updated successfully." });
    }
  );
});
// get Settings endpoint----------------------------------------------------------------------------
app.get("/settings", verifyToken, (req, res) => {
  const id = req.body.id;
  db.query(
    `SELECT save_seach_history, prefrered_units FROM user WHERE id = ?`,
    [id],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      res.status(200).send({
        status: true,
        message: "Settings fetched successfully.",
        data: results[0],
      });
    }
  );
});

// Location endpoint to save location -----------------------------------------------------------
app.post("/location", verifyToken, (req, res) => {
  const { latitude, longitude, name, country, timezone, id } = req.body;
  if (!latitude || !longitude || !name || !country || !timezone)
    return res.status(401).send({
      auth: false,
      token: null,
      message: "Make sure Latitude, Longitude,Name,Country, Time is being sent",
    });
  const uuid = uuidv4();
  db.query(
    "INSERT INTO locations (id, latitude,longitude,name,country,timezone, user_id, type) VALUES (?,?, ?, ?, ?,?,?,?)",
    [uuid, latitude, longitude, name, country, timezone, id, "savedLocation"],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      res.status(200).send({
        status: true,
        message: "Location has been saved successfully!",
      });
    }
  );
});

app.get("/location", verifyToken, (req, res) => {
  const id = req.body.id;
  if (!id) {
    return res.status(401).send({
      auth: false,
      token: null,
      message: "Invalid token",
    });
  }
  db.query(
    `SELECT * FROM locations WHERE type = 'savedLocation' AND user_id = ?`,
    [id],
    (err, locationResults) => {
      if (err) {
        console.error("Error fetching location data:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }

      // Assuming you want to send the fetched location data in the response
      const locationData = locationResults; // Assuming only one location is expected
      console.log("dsijvbsdhujivb", locationData);
      res.status(200).send({
        status: true,
        message: "Location data fetched successfully.",
        data: locationData,
      });
    }
  );
});

//endpoint to delete saved Location----------------------------------------------------------------
app.delete("/location", verifyToken, (req, res) => {
  const { latitude, longitude, name, country, timezone, id } = req.query;
  if (!latitude || !longitude || !name || !country || !timezone)
    return res.status(401).send({
      auth: false,
      token: null,
      message: "Make sure Latitude, Longitude,Name,Country, Time is being sent",
    });
  db.query(
    "DELETE FROM locations WHERE latitude = ? AND longitude = ? AND name = ? AND country = ? AND timezone = ? AND user_id = ? AND type = ?",
    [latitude, longitude, name, country, timezone, id, "savedLocation"],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      res.status(200).send({
        status: true,
        message: "Location has been deleted successfully!",
      });
    }
  );
});

//is this location saved? endpoint----------------------------------------------------------------

app.get("/location/isLocationSaved", verifyToken, (req, res) => {
  const { latitude, longitude, name, country, timezone, id } = req.query;
  console.log(req.query);
  if (!latitude || !longitude || !name || !country || !timezone)
    return res.status(401).send({
      auth: false,
      token: null,
      message: "Make sure Latitude, Longitude,Name,Country, Time is being sent",
    });
  db.query(
    "SELECT * FROM locations WHERE latitude = ? AND longitude = ? AND name = ? AND country = ? AND timezone = ? AND user_id = ? AND type = ?",
    [latitude, longitude, name, country, timezone, id, "savedLocation"],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      if (results.length === 0) {
        return res.status(200).send({
          status: false,
          message: "Location is not saved.",
        });
      }
      res.status(200).send({
        status: true,
        message: "Location is saved.",
        data: results[0],
      });
    }
  );
});

//Search history---------------------------------------------------------------------------------
app.post("/searchHistory", verifyToken, (req, res) => {
  const { latitude, longitude, name, country, timezone, id } = req.body;
  if (!latitude || !longitude || !name || !country || !timezone)
    return res.status(401).send({
      auth: false,
      token: null,
      message: "Make sure Latitude, Longitude,Name,Country, Time is being sent",
    });
  const uuid = uuidv4();
  db.query(
    "INSERT INTO locations (id, latitude,longitude,name,country,timezone, user_id, type) VALUES (?,?, ?, ?, ?,?,?,?)",
    [uuid, latitude, longitude, name, country, timezone, id, "searchHistory"],
    (err, results) => {
      if (err) {
        console.error("Error executing MySQL query:", err);
        return res
          .status(500)
          .send({ status: false, message: "Internal server error." });
      }
      res.status(200).send({
        status: true,
        message: "Search history saved successfully!",
      });
    }
  );
});

app.get("/searchHistory", verifyToken, (req, res) => {
  const { id } = req.query;
  const query =
    "SELECT latitude, longitude, name, country, timezone,create_time FROM locations where type = 'searchHistory' AND user_id = ? ORDER BY create_time DESC";
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error executing MySQL query:", err);
      return res
        .status(500)
        .send({ status: false, message: "Internal server error." });
    }
    if (results.length === 0) {
      return res
        .status(404)
        .send({ status: false, message: "Search history not found." });
    }
    const searchHistory = results.map(
      ({ latitude, longitude, name, country, timezone, create_time }) => ({
        latitude,
        longitude,
        name,
        country,
        timezone,
        create_time,
      })
    );
    res.status(200).send({
      status: true,
      message: "Search history found successfully!",
      data: searchHistory,
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
