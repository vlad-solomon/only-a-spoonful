require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, MessageFlags } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require("@discordjs/voice");
const path = require("path");

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commands = [
	new SlashCommandBuilder().setName("boomconnect").setDescription("Summon the bot to your voice channel"),
	new SlashCommandBuilder().setName("boomdisconnect").setDescription("Make the bot leave the voice channel"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		console.log("Registering global slash commands...");
		await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
		console.log("✅ Global slash commands registered successfully!");
	} catch (error) {
		console.error("❌ Error registering global commands:", error);
	}
})();

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === "boomconnect") {
		const member = interaction.member;
		if (!member.voice.channel) {
			return interaction.reply({ content: "You must be in a voice channel!", flags: MessageFlags.Ephemeral });
		}

		let connection = getVoiceConnection(member.guild.id);
		if (!connection) {
			connection = joinVoiceChannel({
				channelId: member.voice.channel.id,
				guildId: member.guild.id,
				adapterCreator: member.guild.voiceAdapterCreator,
			});
		}

		return interaction.reply({ content: "Boom bot connected! Ready to play Vine Boom when someone undeafens.", flags: MessageFlags.Ephemeral });
	}

	if (interaction.commandName === "boomdisconnect") {
		const connection = getVoiceConnection(interaction.guild.id);
		if (!connection) {
			return interaction.reply({ content: "The bot is not in a voice channel.", flags: MessageFlags.Ephemeral });
		}

		connection.destroy();
		return interaction.reply({ content: "Boom bot disconnected.", flags: MessageFlags.Ephemeral });
	}
});

const cooldowns = new Map();

client.on("voiceStateUpdate", async (oldState, newState) => {
	const userId = newState.member?.id;
	if (!userId) return;

	if (oldState.selfDeaf && !newState.selfDeaf) {
		if (cooldowns.has(userId)) return;
		cooldowns.set(userId, Date.now());
		setTimeout(() => cooldowns.delete(userId), 5000);

		console.log(`Playing Vine Boom sound for ${newState.member.user.tag}`);

		const connection = getVoiceConnection(newState.guild.id);
		if (!connection) return;

		const player = createAudioPlayer();
		const resource = createAudioResource(path.join(__dirname, "vineboom.mp3"));

		player.play(resource);
		connection.subscribe(player);

		player.on(AudioPlayerStatus.Idle, () => {
			console.log("Finished playing Vine Boom sound. Cleaning up player.");
			player.stop();
		});
	}

	if (oldState.channelId && !newState.channelId) {
		const connection = getVoiceConnection(oldState.guild.id);
		if (!connection) return;

		const channel = oldState.guild.channels.cache.get(oldState.channelId);
		if (channel && channel.members.filter((member) => !member.user.bot).size === 0) {
			console.log("Channel is empty. Disconnecting bot.");
			connection.destroy();
		}
	}
});

client.once("ready", () => {
	console.log(`Bot is online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
