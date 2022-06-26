import express, { json } from "express"
import  cors  from "cors"
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";

const app = express()
const hora = dayjs().locale('pt-br')

app.use(cors());
app.use(json());

const mongoClient = new MongoClient("mongodb+srv://lucas_brandao:290400@cluster-brandao.f5lms.mongodb.net/?retryWrites=true&w=majority");
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("banco_api_uol");
});

app.get('/participants', async (req, res) => {
  try{
    const users = await db.collection("users").find({}).toArray();
    res.send(users);
  }catch(error){
    res.sendStatus(500);
  }
});

app.post("/participants", async (req, res)=> {    
     
    const userSchema = Joi.object({
      name: Joi.string().min(1).required()
    });

    const userValidation = userSchema.validate(req.body)
    const {error} = userValidation
    const data = Date.now()

    if (error){
      const errorMsgs = error.details.map(err => err.message)
      res.status(422).send(errorMsgs)
      return;
    }

    try{
      const registeredUser = await db.collection("users").findOne({name : req.body.name})
      if (registeredUser){
        res.status(409).send("Usuário já existente, escolha outro nome de usuário")
        return;
      }

      await db.collection("users").insertOne(
        {
          name: req.body.name ,
          lastStatus: data
        });
      await db.collection("messages").insertOne(
        {
          from: req.body.name,
          to: 'Todos',
          text: 'entra na sala...',
          type: 'status',
          time: hora.format('HH:mm:ss')
        }
      );
      res.sendStatus(201);
    }catch (error){
      res.sendStatus(error);
  }
});

app.post('/messages', async(req, res) => {

    const sender = req.headers.user;
    const message = req.body;
    const messageSchema = Joi.object(
      {
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.string().valid('message','private_message').required()
      });
    
    const messageValidation = messageSchema.validate(message, { abortEarly: false })
    const {error} = messageValidation

    if (error){
      const errorMsgs = error.details.map(err => err.message)
      res.status(422).send(errorMsgs)
      return;
    }

    try {
      const registeredUser = await db.collection("users").findOne({name : sender})
      if (!registeredUser){
        res.send("Usuário não existe, efetue seu cadastro novamente")
        return;
      }

      await db.collection("messages").insertOne(
          {
            from: sender,
            to: message.to,
            text: message.text,
            type: message.type,
            time: hora.format('HH:mm:ss')
          }
        );
      res.sendStatus(201)
    }catch (error){
      res.sendStatus(error);
  }
})

app.get('/messages', async (req, res) => {

  const limit = parseInt(req.query.limit);
  const geter = req.headers.user;

  try{
    const messages = await db.collection("messages").find({from:geter}).toArray()
    
    res.send(messages);
  }catch(error){
    res.sendStatus(500);
  }
});

app.post('/status', async (req, res) => {
  
  const userAtt = req.headers.user
  const data = Date.now()
  
  try{
    const registeredUser = await db.collection("users").findOne({name : userAtt})
      if (!registeredUser){
        res.sendStatus(404)
        return;
      }

    await db.collection("users").updateOne(
        {name: userAtt},
        {$set: {
          lastStatus: data
        }});
      res.sendStatus(201);
    }catch (error){
      res.sendStatus(error);
  }
})

async function disconnectUser(){
  const dateNow = Date.now()
  const ableToDisconnect = await db.collection("users").find({})

}

app.listen(5000 ,  () => console.log('server running - port 5000'));