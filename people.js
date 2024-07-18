const proxy = require("./proxy");
const Logger = require("./logging");
const logger = new Logger("people");
const EventEmitter = require("node:events");

class PeopleManager extends EventEmitter {
    constructor(people, client) {
        super();
        this.ready = false;
        this.people = people;
        this.client = client;
        if(this.client.isReady()) {
            this.reload(this.client);
            return;
        }
        this.client.once("ready", () => this.reload());
    }
    get(name) {
        if(!this.people[name]) return;
        let user = this.client.users.cache.get(this.people[name]);
        if(!user) return;
        return {
            avatar: `/pfps/${name}.webp`,
            name: user.globalName || user.username
        };
    }
    
    async reload() {
        logger.log("Reloading people...");
        for(let key of Object.keys(this.people)) {
            let user = await this.client.users.fetch(this.people[key]);
            this.client.users.cache.set(user.id, user);
            logger.log(`${key} reloaded. (${user.globalName}, ${user.username}, ${user.id})`);
        }
        let lastReadyVal = this.ready;
        this.ready = true;
        if(!lastReadyVal) {
            logger.log("PeopleManager ready.");
            this.emit("ready");
        }
        setTimeout(() => this.reload(), 60000);
    }
    
    pfps(options, errorManager) {
        return (req, res, next) => {
            let id = this.people[req.url.replace(/(^\/)|(\.webp$)/g, "")];
            if(!id) {
                next();
                return;
            }
            let user = this.client.users.cache.get(id);
            if(!user) {
                res.status(500).send(errorManager.getErrorPage(500, this, "This user is currently not in cache, please try again later."))
                return;
            }
            proxy(res, user.avatarURL(options), errorManager);
        };
    }
}

module.exports = PeopleManager;
logger.ready();
