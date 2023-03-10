const Parser = require('./Parser');

function processDuration(content,playtime){
    for(let i in content){
        for(let j in content[i].syllables){
            let oldTiming =  content[i].syllables[j].timing;
            let timing = {
                start:playtime,end:0,
                splitTimes:[],
                splitRatio:[]
            };
            oldTiming.time.forEach(dur => {
                if(dur instanceof Array){
                    playtime += Parser.parseNumber(dur[1]);
                    timing.splitRatio.push(dur[0]);
                }else{
                    playtime += Parser.parseNumber(dur);
                    timing.splitRatio.push(1);
                }
                timing.splitTimes.push(playtime);
            });
            timing.splitTimes.pop();
            let gcd = Parser.calcGCD(timing.splitRatio);
            timing.splitRatio = timing.splitRatio.map(a => a / gcd);
            timing.end = playtime;
            content[i].syllables[j].timing = timing;
        }
    }
    return content;
}

function processTiming(content){
    let lastI = 0;
    let lastJ = -1;
    for(let i in content){
        i = parseInt(i,10);
        for(let j in content[i].syllables){
            j = parseInt(j,10);
            let oldTiming = content[i].syllables[j].timing;
            let [ start,end ] = oldTiming.time;
            let timing = {
                start:null,end:null,
                splitTimes:[],
                splitRatio:[]
            };
            if(Parser.isValidNumber(end)){
                timing.end = Parser.parseNumber(end);
            }
            if(start instanceof Array){
                start.forEach(time => {
                    if(time instanceof Array){
                        timing.splitTimes.push(Parser.parseNumber(time[1]));
                        timing.splitRatio.push(time[0]);
                    }else{
                        timing.splitTimes.push(Parser.parseNumber(time));
                        timing.splitRatio.push(1);
                    }
                });
                timing.start = timing.splitTimes.shift();
            }else{
                timing.start = Parser.parseNumber(start);
            }
            if(content[lastI]
            && content[lastI].syllables[lastJ]
            && content[lastI].syllables[lastJ].timing.end === null){
                content[lastI].syllables[lastJ].timing.end = timing.start;
            }
            let gcd = Parser.calcGCD(timing.splitRatio);
            timing.splitRatio = timing.splitRatio.map(a => a / gcd);
            content[i].syllables[j].timing = timing;
            lastJ = j;
        }
        lastI = i;
    }
    return content;
}

module.exports = class LineConverter{
    static convert(data){
        let lines = [];
        data.lyrics.forEach(line => {
            line.show = Parser.parseNumber(line.show);
            if(line.hide) line.hide = Parser.parseNumber(line.hide);
            line.mode = Parser.isValidNumber(line.start) ? 'duration' : 'timing';
            line.start = Parser.parseNumber(line.start);
            if(typeof line.line != 'number' || line.show < 0) return;
            let content = [];

            line.data.forEach(a => {
                // ????????? ??????
                if(!(a instanceof Array) && typeof a == 'object'){
                    if(a === null) return;
                    a.type = a.type || 'block';
                    if(a.type == 'block'){
                        let block = {
                            ruby:a.ruby,style:null,syllables:[]
                        };
                        let timings = [];
                        a.data.forEach(b => {
                            let syll = { content:b.shift(),style:null };
                            if(typeof b[b.length-1] == 'object' && !(b[b.length-1] instanceof Array)){
                                syll.params = b.pop(); // ?????? ???????????? ???????????? ???????????? ?????? ???
                            }else syll.params = {};
                            syll.timing = { time:b };
                            block.syllables.push(syll);
                            //block[0].push(syll);
                        });
                        content.push(block);
                    }
                }else{ // ????????? ??????
                    let syll = { content:a.shift(),style:null };
                    if(typeof a[a.length-1] == 'object' && !(a[a.length-1] instanceof Array)){
                        syll.params = a.pop(); // ?????? ???????????? ???????????? ???????????? ?????? ???
                    }else syll.params = {};
                    let ruby;
                    if(syll.content instanceof Array){
                        let [ body,rubyy ] = syll.content;
                        syll.content = body;
                        ruby = rubyy;
                    }else{
                        ruby = '';
                    }
                    syll.timing = { time:a };
                    content.push({
                        ruby,style:null,syllables:[syll]
                    });
                }
            });
            
            // ?????? ??????
            for(let i in content){
                for(let j in content[i].syllables){
                    if(content[i].syllables[j].params.style){
                        content[i].syllables[j].style = content[i].syllables[j].params.style;
                        delete content[i].syllables[j].params.style;
                    }
                }
            }
            
            // ????????? ??????
            if(line.mode == 'timing'){
                content = processTiming(content);
            }else if(line.mode == 'duration'){
                content = processDuration(content,line.start);
            }

            lines.push({
                lineCode:line.line,
                showTime:line.show,
                hideTime:line.hide || null,
                sub:line.sub,
                style:line.style || null,
                params:line.params || {},
                content
            });
        });
        return lines;
    }
}