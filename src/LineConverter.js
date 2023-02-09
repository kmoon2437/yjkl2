const Parser = require('./Parser');

const STAKATO_TICK = 1;

module.exports = class LineConverter{
    static convert(data){
        let lines = [];
        data.lyrics.forEach(line => {
            line.show = Parser.parseNumber(line.show);
            if(line.hide) line.hide = Parser.parseNumber(line.hide);
            line.start = Parser.parseNumber(line.start);
            if(typeof line.line != 'number' || line.show < 0) return;
            let syllables = { ruby:[],body:[] };
            let timings = [];
            let playtime = line.start;
            
            // { ruby:'...',count:... } 이런식으로 적어놓은 걸
            // { ruby:'...',data:[...] } 얘로 통합하는 과정
            let data2 = [];
            let rubyCount = 0;
            line.data.forEach(a => {
                if(!(a instanceof Array)){
                    a.type = a.type || 'block';
                    if(a.type == 'block'){
                        data2.push(a);
                        if(typeof a.count == 'number' && a.count > 0){
                            rubyCount = 0;
                        }else if(a.data){
                            rubyCount = Infinity;
                        }
                    }
                    return;
                }
                if(data2[data2.length-1]
                && !(data2[data2.length-1] instanceof Array)
                && rubyCount < data2[data2.length-1].count){
                    if(a[0] instanceof Array){
                        rubyCount = Infinity;
                        data2.push(a);
                    }else{
                        if(!data2[data2.length-1].data) data2[data2.length-1].data = [];
                        data2[data2.length-1].data.push(a);
                        rubyCount++;
                    }
                }else data2.push(a);
            });

            let data = [];
            // 가사/타이밍 분리
            data2.forEach(a => {
                // 객체인 경우
                if(!(a instanceof Array) && typeof a == 'object'){
                    if(a === null) return;
                    a.type = a.type || 'block';
                    if(a.type == 'block'){
                        let block = [[],a.ruby];
                        a.data.forEach(b => {
                            let syll = { content:b.shift() };
                            if(typeof b[b.length-1] == 'object' && !(b[b.length-1] instanceof Array)){
                                syll.params = b.pop(); // 특정 글자에만 스타일을 설정하는 경우 등
                            }
                            block[0].push(syll);
                            timings.push({ time:b,params:syll.params });
                        });
                        data.push(block);
                    }
                }else{ // 배열인 경우
                    let syll = { content:a.shift() };
                    if(typeof a[a.length-1] == 'object' && !(a[a.length-1] instanceof Array)){
                        syll.params = a.pop(); // 특정 글자에만 스타일을 설정하는 경우 등
                    }
                    if(syll.content instanceof Array){
                        let [ body,ruby,startIndex,length ] = syll.content;
                        syll.content = body;
                        data.push([[syll],ruby,startIndex,length]);
                    }else data.push(syll);
                    timings.push({ time:a,params:syll.params });
                }
            });

            // 가사 처리
            let beforeLength = 0;
            data.forEach(a => {
                if(a instanceof Array){
                    let [ body,ruby,startIndex,lengthFromStartIndex ] = a;
                    if(startIndex) beforeLength += startIndex;
                    let length;
                    let nextBeforeLength = 0;
                    if(lengthFromStartIndex){
                        let entireBody = body.map(a => a.content).join('');
                        length = entireBody.slice(startIndex,startIndex+lengthFromStartIndex).length;
                        nextBeforeLength = entireBody.length - length;
                    }else{
                        length = body.reduce((a,b) => a+b.content.length,0);
                        length -= startIndex || 0;
                    }
                    syllables.ruby.push({ beforeLength,ruby,length });
                    syllables.body.push(...body.map(b => {
                        return { content:b.content,style:b.params?.style || null };
                    }));
                    beforeLength = nextBeforeLength;
                }else{
                    beforeLength += a.content.length;
                    syllables.body.push({ content:a.content,style:a.params?.style || null });
                }
            });

            // 타이밍 처리
            timings = timings.map(a => {
                let start = playtime;
                let splitRatio = [];
                let splitTimes = [];
                a.time.forEach(duration => {
                    if(duration instanceof Array){
                        playtime += Parser.parseNumber(duration[1]);
                        splitRatio.push(duration[0]);
                    }else{
                        playtime += Parser.parseNumber(duration);
                        splitRatio.push(1);
                    }
                    splitTimes.push(playtime);
                });
                splitTimes.pop(); // 중간에 나눌 타이밍만 넣기 위함
                let gcd = Parser.calcGCD(splitRatio);
                splitRatio = splitRatio.map(a => a / gcd);
                return {
                    start,end:a.params?.s ? (splitTimes[splitTimes.length-1] ?? start)+STAKATO_TICK : playtime,
                    currentBPM:0,splitTimes,splitRatio
                };
            });

            lines.push({
                lineCode:line.line,
                showTime:line.show,
                hideTime:line.hide || null,
                sub:line.sub,
                style:line.style || null,
                params:line.params || {},timings,
                syllables
            });
        });
        return lines;
    }
}