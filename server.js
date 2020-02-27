const net = require('net');
const port = 6461;
const debug = true;
let users = [];
let channels = [];

const server = net.createServer();

server.on('connection', function(socket) {
	const ip = socket.address().address;
	// Set default username.
	socket.nickname = 'User';
	// Add socket to user list.
	users.push(socket);
	// Log the connection.
	log(`${ip} connected.`);
	// Send welcome message.
	socket.write('Welcome to chat server!\n');
	
	socket.on('data', function(data) {
		// Parse incoming data.
		parse(socket, data.toString().trim());
	});
	
	socket.on('end', function() {
		// Log the end of connection.
		log(`${ip} disconnected.`);
		// Remove the user from list.
		removeUser(socket);
	});
	
	socket.on('error', function(error) {
		log(`Error: ${error.message}`);
	});
});

server.on('error', function(error) {
	log(`Error: ${error.message}`);
});

function parse(socket, data) {
	const token = data.split(' ');
	
	if (token.length > 0) {
		switch (token[0]) {
			case 'msg':
				// Send message.
				if (token.length > 2) {
					if (token[1].charAt(0) === '#') {
						// Channel message.
						sendChannel(token[1], token.slice(2).join(' '), socket);
					} else {
						// Private message.
						sendPrivate(token[1], token.slice(2).join(' '), socket);
					};
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'nick':
				// Set nickname.
				if (token.length === 1) {
					socket.write(`Nickname is ${socket.nickname}.\n`);
				} else if (token.length === 2) {
					nick(token[1], socket);
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'join':
				// Join channel.
				if (token.length === 2 && token[1].charAt(0) === '#') {
					join(token[1], socket);
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'part':
				// Part channel.
				if (token.length === 2 && token[1].charAt(0) === '#') {
					part(token[1], socket);
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'list':
				// Print channel list.
				if (token.length === 1) {
					list(socket);
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'quit':
				// Quit chat.
				if (token.length === 1) {
					socket.end();
				} else {
					socket.write('Invalid command!\n');
				};
				break;
			case 'help':
				help(socket);
				break;
			default:
				socket.write('Invalid command!\n');
		};
	};
};

function log(message) {
	if (debug) {
		console.log(message);
	};
};

function broadcast(sender, list, message) {
	list.forEach(function(socket, index, array) {
		if (socket !== sender) {
			socket.write(message);
		};
	});
};

function getChannel(name) {
	let channel = null;
	
	for (let i = 0; i < channels.length; i++) {
		if (channels[i].name === name) {
			channel = channels[i];
			break;
		};
	};
	
	return channel;
};

function getUser(name) {
	let user = null;
	
	for (let i = 0; i < users.length; i++) {
		if (users[i].nickname === name) {
			user = users[i];
			break;
		};
	};
	
	return user;
};

function sendChannel(channel, message, user) {
	const ch = getChannel(channel);
	
	if (ch != null) {
		if (ch.users.indexOf(user) !== -1) {
			// Send message to channel.
			broadcast(user, ch.users, `[${ch.name}] ${user.nickname}: ${message}\n`);
		} else {
			// User is not in the channel.
			user.write(`You are not in ${channel}.\n`);
		};
	} else {
		// Channel does not exist.
		user.write(`Channel does not exist.\n`);
	};
};

function sendPrivate(to, message, user) {
	const socket = getUser(to);
	
	if (socket != null) {
		// Send private message.
		socket.write(`${user.nickname}: ${message}\n`);
	} else {
		// User does not exist.
		user.write(`User does not exist.\n`);
	};
};

function nick(nickname, user) {
	user.nickname = nickname;
	user.write(`Nickname set to ${user.nickname}.\n`);
};

function join(channel, user) {
	const ch = getChannel(channel);
	
	if (ch != null) {
		// Join the channel.
		if (ch.users.indexOf(user) == -1) {
			// User is not in the channel.
			ch.users.push(user);
			broadcast(user, ch.users, `[${ch.name}] ${user.nickname} has joined the channel.\n`);
			user.write(`You have joined ${ch.name}.\n`);
		} else {
			// User is already in the channel.
			user.write(`You are already in ${ch.name}.\n`);
		};
	} else {
		// Create the channel.
		let chan = {
			name: channel,
			users: [user]
		};
		channels.push(chan);
		user.write(`You have created ${channel}.\n`);
	};
};

function part(channel, user) {
	const ch = getChannel(channel);
	
	if (ch != null) {
		// Part the channel.
		if (ch.users.indexOf(user) !== -1) {
			// User is in the channel.
			if (ch.users.length > 1) {
				// Channel has users after parting.
				removeItem(ch.users, user);
				broadcast(user, ch.users, `[${ch.name}] ${user.nickname} has left the channel.\n`);
			} else {
				// Channel is left empty.
				removeItem(channels, ch);
			};
			user.write(`You have parted ${channel}.\n`);
		} else {
			// User is not in the channel.
			user.write(`You are not in ${channel}.\n`);
		};
	} else {
		user.write(`Channel does not exist.\n`);
	};
};

function list(user) {
	channels.forEach(function(channel, index, array) {
		user.write(`${channel.name} [${channel.users.length}]\n`);
	});
};

function help(user) {
	user.write('Commands:\n');
	user.write('join #channel\t\tJoin the channel.\n');
	user.write('part #channel\t\tPart the channel.\n');
	user.write('msg #channel message\tSend message to channel.\n');
	user.write('msg user message\tSend private message to user.\n');
	user.write('list\t\t\tList available channels.\n');
	user.write('nick name\t\tSet nickname to name.\n');
	user.write('quit\t\t\tDisconnect from the server.\n');
};

function removeUser(user) {
	// Remove user from channels.
	channels.forEach(function(channel, index, array) {
		removeItem(channel.users, user);
	});
	// Remove user from user list.
	removeItem(users, user);
};

function removeItem(list, item) {
	const index = list.indexOf(item);
	if (index !== -1) {
		list.splice(index, 1);
	};
};

server.listen(port, function() {
	console.log(`Chat server running on port ${server.address().port}`);
});