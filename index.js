const { Client, Intents, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const TOKEN =
  "";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let events = {};
let predictions = {};

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
  fs.writeFileSync("events.json", JSON.stringify(events, null, 2), "utf8");
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

  if (command === "!addevent") {
    // Usage: !addEvent UFC280 2024-01-01
    const eventName = args[0];
    const eventDate = args[1];
    if (!eventName || !eventDate) {
      return message.channel.send("Usage: !addEvent <EventName> <YYYY-MM-DD>");
    }

    events[eventName] = {
      date: eventDate,
      fights: [],
    };
    saveData();
    message.channel.send(`Event ${eventName} added for date ${eventDate}.`);
  } else if (command === "!addfight") {
    // Usage: !addFight UFC280 "Fighter One" "Fighter Two"
    const eventName = args.shift();
    if (!events[eventName]) {
      return message.channel.send(`Event ${eventName} does not exist.`);
    }

    // The remaining args should be fighter names.
    // You can parse quotes or just assume they come in a simpler format.
    // For simplicity, let's assume fighters are just the next two words:
    const fighter1 = args[0];
    const fighter2 = args[1];

    if (!fighter1 || !fighter2) {
      return message.channel.send(
        "Usage: !addFight <EventName> <Fighter1> <Fighter2>"
      );
    }

    events[eventName].fights.push({ fighter1, fighter2, winner: null });
    saveData();
    message.channel.send(
      `Fight added to ${eventName}: ${fighter1} vs. ${fighter2}`
    );
  } // After the existing commands...
  else if (command === "!predict") {
    // Usage: !predict UFC280 0 Charles
    // Means: For the event UFC280, fight at index 0, pick Charles
    const eventName = args[0];
    const fightIndex = parseInt(args[1], 10);
    const pick = args[2];

    if (!events[eventName]) {
      return message.channel.send(`Event ${eventName} not found.`);
    }
    if (isNaN(fightIndex) || !events[eventName].fights[fightIndex]) {
      return message.channel.send(
        `Fight index ${fightIndex} not valid for event ${eventName}.`
      );
    }

    const fight = events[eventName].fights[fightIndex];
    if (pick !== fight.fighter1 && pick !== fight.fighter2) {
      return message.channel.send(
        `Your pick must be one of the fighters: ${fight.fighter1} or ${fight.fighter2}`
      );
    }

    const userId = message.author.id;
    if (!predictions[userId]) predictions[userId] = {};
    if (!predictions[userId][eventName]) predictions[userId][eventName] = {};

    predictions[userId][eventName][fightIndex] = pick;

    saveData();

    message.channel.send(
      `You predicted ${pick} for fight #${fightIndex} in ${eventName}`
    );
  } else if (command === "!mypredictions") {
    // Usage: !mypredictions UFC280
    const eventName = args[0];
    const userId = message.author.id;

    if (!predictions[userId] || !predictions[userId][eventName]) {
      return message.channel.send(
        `You have not made any predictions for ${eventName}.`
      );
    }

    const userPreds = predictions[userId][eventName];
    let response = `Your predictions for ${eventName}:\n`;

    events[eventName].fights.forEach((fight, index) => {
      const pick = userPreds[index];
      response += `Fight #${index}: ${fight.fighter1} vs. ${
        fight.fighter2
      } => You picked: ${pick ? pick : "No prediction"}\n`;
    });

    message.channel.send(response);
  } else if (command === "!listevents") {
    const eventNames = Object.keys(events);
    if (eventNames.length === 0) {
      return message.channel.send("No events currently exist.");
    }

    let response = "Current Events:\n";
    for (const [name, eventData] of Object.entries(events)) {
      response += `${name} - Date: ${eventData.date}, Fights: ${eventData.fights.length}\n`;
    }
    message.channel.send(response);
  } else if (command === "!deleteevent") {
    const eventName = args[0];
    if (!eventName) {
      return message.channel.send("Usage: !deleteEvent <EventName>");
    }

    if (!events[eventName]) {
      return message.channel.send(`Event ${eventName} does not exist.`);
    }

    delete events[eventName];
    saveData();
    message.channel.send(`Event ${eventName} has been deleted.`);
  } else if (command === "!removefight") {
    const eventName = args[0];
    const fightIndex = parseInt(args[1], 10);

    if (!eventName || isNaN(fightIndex)) {
      return message.channel.send(
        "Usage: !removeFight <EventName> <FightIndex>"
      );
    }

    if (!events[eventName]) {
      return message.channel.send(`Event ${eventName} does not exist.`);
    }

    if (!events[eventName].fights[fightIndex]) {
      return message.channel.send(
        `Fight index ${fightIndex} is not valid for event ${eventName}.`
      );
    }

    // Remove the fight
    events[eventName].fights.splice(fightIndex, 1);

    // Save changes
    saveData();

    message.channel.send(`Fight #${fightIndex} removed from ${eventName}.`);
  } else if (command === "!guide") {
    const guideMessage = `
**UFC Prediction Bot Commands**

**!addEvent <EventName> <YYYY-MM-DD>**
- Description: Adds a new event with the given name and date.
- Example: !addEvent UFC280 2024-01-01

**!addFight <EventName> <Fighter1> <Fighter2>**
- Description: Adds a fight to the specified event.
- Example: !addFight UFC280 Charles Islam

**!removeFight <EventName> <FightIndex>**
- Description: Removes the fight at the given index from the specified event.
- Example: !removeFight UFC280 0

**!deleteEvent <EventName>**
- Description: Deletes the specified event and all its fights/predictions.
- Example: !deleteEvent UFC280

**!predict <EventName> <FightIndex> <FighterName>**
- Description: Records your prediction for the winner of a specified fight in an event.
- Example: !predict UFC280 0 Charles

**!myPredictions <EventName>**
- Description: Lists all your predictions for a given event.
- Example: !myPredictions UFC280

**!listEvents**
- Description: Shows all current events, their dates, and the number of fights.
- Example: !listEvents

**!guide**
- Description: Displays this help guide with all available commands.

**Note:**
- When adding or predicting fights, the "FightIndex" starts from 0 for the first fight in an event.
- Make sure to use exact EventNames and fighter names as added.`;

    message.channel.send(guideMessage);
  }



});

client.login(TOKEN);
