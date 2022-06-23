import express, { json } from "express"
import  cors  from "cors"
import { MongoClient } from "mongodb";
import Joi from "joi";

const app = express()

app.use(cors());
app.use(json());

const mongoClient = new MongoClient("mongodb+srv://lucas_brandao:290400@cluster-brandao.f5lms.mongodb.net/?retryWrites=true&w=majority");
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("banco_api_uol");
});

app.get('/participants', (req, res) => {
    const promise = db.collection("users").find({}).toArray();
    promise.then(user => res.send(user));
    promise.catch(e => res.sendStatus(500));
  });

app.post("/participants", (req, res)=> {
    if (!req.body.name ) {
        res.status(422).send("Nome de usuário é obrigatório");
        return;
      }

    const promise = db.collection("users").insertOne(
        {
            name: req.body.name
        });
    promise.then(() => res.sendStatus(201));
    promise.catch(e => res.sendStatus(500));
});

app.listen(5000 ,  () => console.log('server running - port 5000'));