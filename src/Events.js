module.exports = class Events{
    constructor(events){
        this._events = (events instanceof Events)
            ? events.get_all() : (events || {});
    }

    add(ms,name,data,unshift = false){
        ms = Math.max(0,Math.round(ms));
        if(!this._events[ms]) this._events[ms] = [];
        if(unshift) this._events[ms].unshift({ name:name,data:data });
        else this._events[ms].push({ name:name,data:data });
    }
    
    getAll(eventName){
        if(eventName){
            let events = {};
            for(let i in this._events){
                this._events[i].filter(a => a.name == eventName).forEach(a => {
                    if(!events[i]) events[i] = [];
                    events[i].push(a);
                });
            }
            return events;
        }else{
            return this._events;
        }
    }
}