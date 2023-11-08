const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin:[
    'https://a-11-online-group-study.web.app',
   'https://a-11-online-group-study.firebaseapp.com',
    'http://localhost:5173',
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.29d8nwh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares

const logger = async(req, res, next) =>{
  console.log('called', req.host, req.originalUrl)
  next()
}

const verifyToken = async(req,res, next) =>{
  const token = req.cookies.token
  if(!token){
    return res.status(401).send({message: 'not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
    if(error){
      return res.status(401).send({message: 'not authorized'});
    }
    console.log('value in the token', decoded)
    req.user = decoded
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const assignmentsCollection = client
      .db("online_study_group_DB")
      .collection("assignments");
    const submittedAssignmentCollection = client
      .db("online_study_group_DB")
      .collection("submittedAssignment");

    // auth api
    app.post('/jwt', logger, async(req, res)=>{
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '3h'})
      res
      .cookie('token', token,{
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success: true})
    })

    app.post('/logout', async(req, res)=>{
      const user = req.body;
      console.log('logged out', user)
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    //assignment related api
    app.post("/assignments", async (req, res) => {
      const newAssignment = req.body;
      console.log(newAssignment);
      const result = await assignmentsCollection.insertOne(newAssignment);
      res.send(result);
    });

    app.get("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentsCollection.findOne(query);
      res.send(result);
    });

    app.put("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedAssignment = req.body;
      const assignment = {
        $set: {
          assignment_name: updatedAssignment.assignment_name,
          due_date: updatedAssignment.due_date,
          assignment_image: updatedAssignment.assignment_image,
          marks: updatedAssignment.marks,
          level: updatedAssignment.level,
          description: updatedAssignment.description,
        },
      };
      const result = await assignmentsCollection.updateOne(
        filter,
        assignment,
        options
      );
      res.send(result);
    });

    app.delete('/assignment/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await assignmentsCollection.deleteOne(query)
      res.send(result)
    })

    app.get("/assignments",logger, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await assignmentsCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/assignmentsCount", async (req, res) => {
      const count = await assignmentsCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // submitted assignment related API
    app.post("/submittedAssignments", async (req, res) => {
      const submittedAssignment = req.body;
      console.log(submittedAssignment);
      const result = await submittedAssignmentCollection.insertOne(submittedAssignment);
      res.send(result);
    });

    app.get("/submittedAssignments", logger, verifyToken, async (req, res) => {
      console.log(req.query.email)
      console.log('token', req.cookies.token)
      console.log('user in the valid token', req.user)
      
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'Forbidden'})
      }

      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }

      const result = await submittedAssignmentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/allSubmission", async(req, res)=>{
      const result = await submittedAssignmentCollection.find().toArray();
      res.send(result);
    })

    app.get("/submittedAssignments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await submittedAssignmentCollection.findOne(query);
      res.send(result);
    });

    app.patch('/submittedAssignments/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)}
      const updatedAssignment = req.body;
      const updateDoc ={
        $set:{
          status: updatedAssignment.status,
          obtained_marks: updatedAssignment.obtained_marks,
          feedback: updatedAssignment.feedback
        },
      };
      const result = await submittedAssignmentCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Assignments are here");
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
