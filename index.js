const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
/* ============== middleware ====================*/
app.use(cors());
app.use(express.json())
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xtje8.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
/*============ verify Token  ============== */
function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'UnAuthorization' })
  }
  const Token = authorization.split(' ')[1]
  jwt.verify(Token, process.env.JWT_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(402).send({ message: 'UnAuthorization' })
    }
    req.decoded = decoded
    next();
  });


}
async function run() {
  try {
    await client.connect();
    const collectionServices = client.db("Doctors").collection("services");
    const collectionBooking = client.db("Doctors").collection("booking");
    const collectionUser = client.db("Doctors").collection("user");
    app.get('/services', async (req, res) => {
      const query = {};
      const cursor = collectionServices.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })
    /* ============== user token create  ==================  */
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      }
      const token = jwt.sign({ email: email }, process.env.JWT_TOKEN);
      const result = await collectionUser.updateOne(filter, updateDoc, options);
      res.send({ result, token })
    })
    /* =========== user token update =========== */
    app.put('/user/admin/:email',verifyJWT, async (req, res) => {
      const admin = req.params.id;
      const UserEmail = req.decoded.email;
      console.log(UserEmail)
      const userAmin = await collectionUser.findOne({ email: UserEmail });
      if (userAmin.role === 'admin') {
        const filter = { email: admin };
        const updateDoc = {
          $set: { role: 'admin' },
        }
        const result = await collectionUser.updateOne(filter, updateDoc);
        res.send({ success: true, result })
      }
      res.status(401).send({message:'Forbidden access'})

    })


    /* ================= Admin user  ===================== */
    app.get('/admin/:email',async(req,res)=>{
      const adminEmail = req.params.email;
      const userAdmin = await collectionUser.findOne({ email: adminEmail });
      const admin = userAdmin.role === 'admin';
      res.send(admin)
    })
    
    /* =========== post booking ============== */
    app.post('/booking', async (req, res) => {
      const data = req.body;
      const query = { name: data.name, date: data.date, email: data.email }
      const Appointment = await collectionBooking.findOne(query);
      if (Appointment) {
        return res.send({ success: false, Appointment })
      }
      const result = await collectionBooking.insertOne(data);
      res.send({ success: true, result })
    })
    /*==================== All user get ============== */
    app.get('/users', verifyJWT, async (req, res) => {
      const User = await collectionUser.find().toArray()
      res.send(User)
    })
    /* =========== get booking My dashboard ============== */
    app.get('/bookings', verifyJWT, async (req, res) => {
      const user = req.query.email;
      const decoded = req.decoded.email;
      if (user === decoded) {
        const query = { email: user }
        const Appointment = await collectionBooking.find(query).toArray();
        return res.send(Appointment)
      }
      else {
        res.status(402).send({ message: 'Forbidden access' })
      }
    })

    /* ================ Available ================  */
    app.get('/available', async (req, res) => {
      const data = req.query.date;
      const services = await collectionServices.find().toArray();
      const query = { date: data }
      const booking = await collectionBooking.find(query).toArray();
      services.forEach(service => {
        const serviceBooking = booking.filter(b => b.name === service.name)
        const booked = serviceBooking.map(s => s?.slot)
        const available = service.slots.filter(s => !booked.includes(s))
        service.slots = available
      })
      res.send(services)
    })

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})