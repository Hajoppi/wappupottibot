'use strict';

const TeleBot = require('telebot'),
      token = require('./config'),
      https = require('https'),
      fs = require('fs'),
      axios = require('axios');

const bot = new TeleBot(token);
const fileLocation = '/home/pi/workspace/mieli/chats.json';
var chats = new Set();

var lastIds = [];
var total = '';
var anonymousQueue = {};

//const url= 'https://potti.mielenterveysseura.fi/f/Donation/GetDonations/?collectionId=COL-16-1231&pageSize=5&startAt=0';
const url = 'https://oma.helsinkimissio.fi/f/Donation/GetDonations/?collectionId=COL-16-3669&pageSize=5&startAt=0';
//const totalUrl = 'https://potti.mielenterveysseura.fi/f/Collection/GetDynamicProperties/COL-16-1231';
const totalUrl = 'https://oma.helsinkimissio.fi/f/Collection/GetDynamicProperties/COL-16-3669';
const saveChatsToFile = () => {
  fs.writeFile(fileLocation, JSON.stringify(Array.from(chats)) , 'utf-8', function (err) {
    if (err) {
        console.log("an error on save");
        return console.log(err);
    }
    console.log("saved");
  });
};

const loadChatsFromFile = () => {
    fs.readFile(fileLocation, 'utf-8', function (err, data) {
        if(err) console.log(err);
        else chats = new Set(JSON.parse(data));
    });
    console.log("Data was loaded");
};

bot.on('/start', function(msg) {
    chats.add(msg.chat.id);
    saveChatsToFile();
    return msg.reply.text("Bot started");
});

bot.on('/stop', function(msg) {
    chats.delete(msg.chat.id);
    saveChatsToFile();
    return msg.reply.text("Bot stopped");
});

bot.on('/total', function(msg) {
  return msg.reply.text(`Kokonaisuudessaan lahjoitettu: ${total}€`);
});

const sendNewDonationMsg = (donations) => {
  donations.forEach((donation) => {
    const name = donation.Name;
    const amount = donation.Amount;
    const message = donation.Message;
    console.log(`${name} lahjoitti ${amount}€\n"${message}"`);
    for(let i of chats){
      bot.sendMessage(i, `${name} lahjoitti ${amount}€\n"${message}"\nKokonaisuudessaan lahjoitettu: ${total}€`);
    }
  });
}

const getData = async () => {
  try {
    const totalRes = await axios.get(totalUrl);
    total = totalRes.data.raisedAmountAsString;

    const donationRes = await axios.get(url);
    const results = [];

    donationRes.data.forEach((donation) => {
      if (lastIds.indexOf(donation.DonationId) > -1) {
        console.log("already sent");
      }else if (donation.DonationId in anonymousQueue) {
        delete anonymousQueue[donation.DonationId];
        results.push(donation);
      }else if(donation.Name === "Anonyymi" || donation.Message.length === 0) {
        anonymousQueue[donation.DonationId] = donation;
      } else {
        results.push(donation);
      }
    });
    console.log("New messages are " + JSON.stringify(results));
    console.log("Waiting queue " + JSON.stringify(anonymousQueue));
    return results;
  } catch(error) {
    console.error(error);
  }
};

const check = async () => {
  const res = await getData();
  res.forEach((donation) => {
    lastIds.push(donation.DonationId);
  });
  while (lastIds.length > 20){
    lastIds.shift();
  }
  console.log("Used Ids are " + lastIds);
  sendNewDonationMsg(res);
};

check();
setInterval(check, 120000);

loadChatsFromFile();
bot.start();
