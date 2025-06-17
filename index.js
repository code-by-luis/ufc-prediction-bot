const {
  Client,
  Intents,
  ActionRowBuilder,
  ButtonBuilder,
  GatewayIntentBits,
} = require("discord.js");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const TOKEN =
  "PLACEHOLDER;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let events = {};
let predictions = {};

// Function to scrape UFC event data along with fight details
async function addEvent(url) {
  try {
    // Fetch the event page content
    const { data } = await axios.get(url);

    // Load the HTML data into Cheerio for parsing
    const $ = cheerio.load(data);

    // Scrape the event details
    const eventName = $("h1").text().trim();
    const eventDate = "test";

    if (!eventName || !eventDate) {
      throw new Error("Could not find event details.");
    }

    // Scrape the fight details
    let fights = [];

    $(".c-listing-fight__names-row").each((index, element) => {
      const fighter1Name = $(element)
        .find(
          ".c-listing-fight__corner-name--red .c-listing-fight__corner-given-name"
        )
        .text()
        .trim();
      const fighter2Name = $(element)
        .find(
          ".c-listing-fight__corner-name--blue .c-listing-fight__corner-given-name"
        )
        .text()
        .trim();

      const fighter1Name2 = $(element)
        .find(
          ".c-listing-fight__corner-name--red .c-listing-fight__corner-family-name"
        )
        .text()
        .trim();
      const fighter2Name2 = $(element)
        .find(
          ".c-listing-fight__corner-name--blue .c-listing-fight__corner-family-name"
        )
        .text()
        .trim();

      const fullName1 = fighter1Name + " " + fighter1Name2;
      const fullName2 = fighter2Name + " " + fighter2Name2;

      if (fullName1 && fullName2) {
        fights.push({
          fighter1: fullName1,
          fighter2: fullName2,
          result: 0,
        });
      }
    });

    return {
      eventName,
      eventDate,
      fights,
    };
  } catch (error) {
    console.error("Error scraping UFC event:", error);
    return null;
  }
}

function loadData() {
  // Load events
  if (fs.existsSync("events.json")) {
    const eventsData = fs.readFileSync("events.json", "utf8");
    events = JSON.parse(eventsData);
  } else {
    events = {};
  }

  // Load predictions
  if (fs.existsSync("predictions.json")) {
    const predictionsData = fs.readFileSync("predictions.json", "utf8");
    predictions = JSON.parse(predictionsData);
  } else {
    predictions = {};
  }
}

function saveData() {
  fs.writeFileSync(
    "predictions.json",
    JSON.stringify(predictions, null, 2),
    "utf8"
  );
}

loadData();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const args = message.content.split(" ");
  const command = args.shift().toLowerCase(); // first word is the command

  // Command for adding an event
  if (command === "!addevent") {
    const eventUrl = args[0];
    if (!eventUrl) {
      return message.channel.send("Please provide a valid UFC event URL.");
    }

    addEvent(eventUrl).then((eventData) => {
      if (!eventData) {
        return message.channel.send("Failed to scrape event data.");
      }

      console.log(JSON.stringify(eventData));

      events.push({
        eventName: eventData.eventName,
        date: eventData.eventDate,
        fights: eventData.fights,
      });

      console.log(JSON.stringify(events));

      // Save the updated events data
      fs.writeFileSync("events.json", JSON.stringify(events, null, 2), "utf8");

      message.channel.send(
        `Event "${eventData.eventName}" added successfully with ${eventData.fights.length} fights.`
      );
    });
  }

  if (command === "!mypredictions") {
    if (!Object.keys(predictions).length) {
      return message.channel.send("You haven't made any predictions yet.");
    }

    const userPredictions = Object.keys(predictions).filter(
      (event) => predictions[event][message.author.id]
    );

    if (userPredictions.length === 0) {
      return message.channel.send("You have no predictions for any events.");
    }

    const eventButtons = userPredictions.map((event, index) => {
      return new ButtonBuilder()
        .setCustomId(`viewPredictions-${index}`)
        .setLabel(event)
        .setStyle("Primary");
    });

    const row = new ActionRowBuilder().addComponents(eventButtons);

    message.channel.send({
      content: "Select an event to view your predictions:",
      components: [row],
    });
  }

  // Command to show the next event
  if (command === "!showNextEvent") {
    // Format the message with the event name and all the fights
    let response = `Next Event: **${events[0].eventName}**\nDate: ${events[0].date}\nFights:\n`;

    events[0].fights.forEach((fight, index) => {
      response += `#${index}: ${fight.fighter1} vs ${fight.fighter2}\n`;
    });

    message.channel.send(response);
  }

  if (command === "!p") {
    if (events.length === 0) {
      return message.channel.send("No upcoming events available.");
    }

    // Show list of events with buttons
    const eventButtons = events.map((event, index) => {
      return new ButtonBuilder()
        .setCustomId(`selectEvent-${index}`)
        .setLabel(event.eventName)
        .setStyle("Primary");
    });

    const row = new ActionRowBuilder().addComponents(eventButtons);

    message.channel.send({
      content: "Select an event to predict on:",
      components: [row],
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [type, eventIndex, fightIndex, fighterIndex] = interaction.customId.split("-");

  if (type === "selectEvent") {
    const selectedEvent = events[eventIndex];
    let fightButtons = selectedEvent.fights.map((fight, index) => {
      return new ButtonBuilder()
        .setCustomId(`selectFight-${eventIndex}-${index}`)
        .setLabel(`${fight.fighter1} vs ${fight.fighter2}`)
        .setStyle("Primary");
    });

    // Split fight buttons into multiple ActionRows if there are more than 5 buttons
    const fightButtonRows = [];
    while (fightButtons.length > 0) {
      fightButtonRows.push(fightButtons.splice(0, 5)); // Take up to 5 buttons at a time
    }

    // Create action rows with the split buttons
    const rows = fightButtonRows.map((row) =>
      new ActionRowBuilder().addComponents(row)
    );

    interaction.update({
      content: `Select a fight for event: **${selectedEvent.eventName}**`,
      components: rows,
    });
  }

 if (type === "selectFight") {
   const selectedEvent = events[eventIndex];
   const selectedFight = selectedEvent.fights[fightIndex];

   const predictionButtons = [
     new ButtonBuilder()
       .setCustomId(`predict-${eventIndex}-${fightIndex}-1`)
       .setLabel(`Predict ${selectedFight.fighter1}`)
       .setStyle("Success"),
     new ButtonBuilder()
       .setCustomId(`predict-${eventIndex}-${fightIndex}-2`)
       .setLabel(`Predict ${selectedFight.fighter2}`)
       .setStyle("Success"),
   ];

   // Add a "Back" button to go back to the fight list
   const backButton = new ButtonBuilder()
     .setCustomId(`backToFights-${eventIndex}`)
     .setLabel("Back")
     .setStyle("Secondary");

   const row = new ActionRowBuilder().addComponents(
     ...predictionButtons,
     backButton
   );

   interaction.update({
     content: `Who do you predict will win: ${selectedFight.fighter1} vs ${selectedFight.fighter2}?`,
     components: [row],
   });
 }


 if (type === "predict") {
   const selectedEvent = events[eventIndex];
   const selectedFight = selectedEvent.fights[fightIndex];
   const fighterPredicted = fighterIndex === "1" ? selectedFight.fighter1 : selectedFight.fighter2;


    if (!predictions[selectedEvent.eventName]) {
      predictions[selectedEvent.eventName] = {};
    }

    if (!predictions[selectedEvent.eventName][interaction.user.id]) {
      predictions[selectedEvent.eventName][interaction.user.id] = [];
    }

     predictions[selectedEvent.eventName][interaction.user.id].push({
       fight: `${selectedFight.fighter1} vs ${selectedFight.fighter2}`,
       prediction: fighterPredicted,
     });

     interaction.update(
       `Prediction saved! You predict ${fighterPredicted} will win the fight: ${selectedFight.fighter1} vs ${selectedFight.fighter2}.`
     );


   fs.writeFileSync(
     "predictions.json",
     JSON.stringify(predictions, null, 2),
     "utf8"
   );
 }

 if (type === "viewPredictions") {
   const userEvents = Object.keys(predictions).filter(
     (event) => predictions[event][interaction.user.id]
   );

   const selectedEvent = userEvents[eventIndex];

   const userPredictions = predictions[selectedEvent][interaction.user.id];

   let response = `Your Predictions for **${selectedEvent}**:\n`;
   userPredictions.forEach((p, index) => {
     response += `${
       p.fight
     }\n➡ **Predicted Winner:** ${p.prediction}\n\n`;
   });

   interaction.update({
     content: response,
     components: [],
   });
 }

 if (type === "backToFights") {
   const selectedEvent = events[eventIndex];

   let fightButtons = selectedEvent.fights.map((fight, index) => {
     return new ButtonBuilder()
       .setCustomId(`selectFight-${eventIndex}-${index}`)
       .setLabel(`${fight.fighter1} vs ${fight.fighter2}`)
       .setStyle("Primary");
   });

   // Split fight buttons into multiple ActionRows if there are more than 5
   const fightButtonRows = [];
   while (fightButtons.length > 0) {
     fightButtonRows.push(fightButtons.splice(0, 5));
   }

   const rows = fightButtonRows.map((row) =>
     new ActionRowBuilder().addComponents(row)
   );

   interaction.update({
     content: `Select a fight for event: **${selectedEvent.eventName}**`,
     components: rows,
   });
 }

});

client.login(TOKEN);