import express, { json } from "express"
import  cors  from "cors"
import { MongoClient, ObjectId } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from 'dotenv';

dotenv.config();

const app = express()

app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("banco_api_uol");
});

//rotas de participantes

app.get('/participants', async (req, res) => {
  try{
    const users = await db.collection("users").find({}).toArray();
    res.send(users);
  }catch(error){
    res.sendStatus(500);
  }
});

app.post("/participants", async (req, res)=> {    
     
    const hora = dayjs().locale('pt-br')

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
          name: req.body.name.trim() ,
          lastStatus: data
        });
      await db.collection("messages").insertOne(
        {
          from: req.body.name.trim(),
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

//rotas de mensagens 

app.post('/messages', async(req, res) => {
    const hora = dayjs().locale('pt-br')

    const sender = req.headers.user.trim();
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
        res.send("Usuário não existe, efetue seu cadastro novamente").status(404)
        return;
      }

      await db.collection("messages").insertOne(
          {
            from: sender,
            to: message.to,
            text: message.text.trim(),
            type: message.type.trim(),
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
    const messages = await db.collection("messages").find({$or : [{from:geter}, {to:geter}, {to: "Todos"}]}).toArray()
    
    if (limit){
      res.send([...messages].slice(0, limit));
    }else{
      res.send([messages]);
    }
  }catch(error){
    res.sendStatus(500);
  }
});

app.delete('/messages/:id', async (req, res) => {
  
  const user = req.headers.user;
  const id = req.params.id;

  try{
    const messageToDelete = await db.collection('messages').findOne({ _id: new ObjectId(id) })

    if (!messageToDelete){
      res.sendStatus(404);
      return;
    }
    if(messageToDelete.from !== user){
      res.sendStatus(401);
      return;
    }

    await db.collection('messages').deleteOne({ _id: ObjectId(id) })
    res.send("Mensagem deletada com sucesso").status(200)

  }catch (error){
    res.send(error)
  }
});

app.put('/messages/:id', async(req, res) => {
  const hora = dayjs().locale('pt-br')

  const id = req.params.id;
  const sender = req.headers.user.trim();
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
      res.status(404).send("Usuário não existe, efetue seu cadastro novamente")
      return;
    }

    const messageToUpdate = await db.collection('messages').findOne({_id: new ObjectId(id)})

    if (!messageToUpdate){
      res.sendStatus(404);
      return;
    }

    if (sender === messageToUpdate.from){
      
      await db.collection("messages").updateOne(
          {_id: ObjectId(id)},
          {
            $set: {to: message.to.trim()},
            $set: {text: message.text.trim()},
            $set: {type: message.type.trim()},
            $set: {time: hora.format('HH:mm:ss')}
          }
        );
      res.status(201).send("Mensagem editada com sucesso");
      }else{
        res.status(401).send("Voce não é o autor da mensagem");
      }
  }catch (error){
    res.sendStatus(error);
}
})

//rota de status

app.post('/status', async (req, res) => {
  
  const userAtt = req.headers.user.trim()
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
      res.sendStatus(200);
    }catch (error){
      res.sendStatus(error);
  }
})

async function disconnectUser(){

  const hora = dayjs().locale('pt-br')

  const dateNow = Date.now()
  const lessThan10 = dateNow - 10000
  const ableToDisconnect = await db.collection("users").find({lastStatus: {$lt: lessThan10}}).toArray()
  await db.collection("users").deleteMany({lastStatus: {$lt: lessThan10}})
  
  for (let i = 0; i < ableToDisconnect.length ; i++){
    await db.collection("messages").insertOne(
      {
        from: ableToDisconnect[i].name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: hora.format('HH:mm:ss')
      }
    )
  }
}

setInterval(disconnectUser, 15000)

app.listen(5000 ,  () => console.log('server running - port 5000'));