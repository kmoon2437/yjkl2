const { SingleDuration,DurationCollection } = require('./utilClasses');
const mathjs = require('mathjs');

const ALPHABETS = require('./alphabets'); // 영어,라틴문자,키릴문자,그리스문자 등등등
const WIDTH_CONVERT_TABLE = require('./widthConvert');
const BODY_BLOCK = { '[':']' };
const RUBY_BLOCK = { '{':'}','<':'>' };
const FORCE_SPLIT = '/';
const CONNECT_SYLLABLES = '*';
const SPLIT_ALPHABET = '_';
const ESCAPE = '\\';
const LINE_END = '-';
const FORCE_START_COUNT = '#';
const SPACE_REGEX = /[\u0020\u00a0\u3000]+/g; // \u0020(일반 띄어쓰기)와 \u00a0(nbsp), \u3000(전각 띄어쓰기)를 모두 인식
const TYPE_BRACKET_OPEN = '(';
const TYPE_BRACKET_CLOSE = ')';
const WORD_RUBY = ':';
const CHANGE_TYPE_START = '@';
const CHANGE_TYPE_END = ';';
const COMMENT_REGEX1 = /\/\/.*/g; // 한줄 주석
const COMMENT_REGEX2 = /\/\*(.*?)\*\//gs; /* 여러줄 주석 */
const NUMBER_ALLOWED = '0123456789.+-*/()^';
const SPECIAL_CHARS = [FORCE_SPLIT,CONNECT_SYLLABLES,SPLIT_ALPHABET];
const SPECIAL_CHARS2 = [...Object.keys(BODY_BLOCK),TYPE_BRACKET_OPEN];

function removeComments(str){
    return str.replace(COMMENT_REGEX2,'').replace(COMMENT_REGEX1,'').trim();
}

function strReplaceAll(str,a,b){
    if(a instanceof Array && !(b instanceof Array)){
        for(let s of a){
            str = strReplaceAll(str,s,b);
        }
    }else if(b instanceof Array && !(a instanceof Array)){
        for(let s of b){
            str = strReplaceAll(str,a,s);
        }
    }else if(a instanceof Array && b instanceof Array){
        let cnt = Math.max(a.length,b.length);
        for(let i = 0;i < cnt;i++){
            str = strReplaceAll(str,a[Math.min(i,a.length-1)],b[Math.min(i,b.length-1)]);
        }
    }else{
        str = str.replaceAll(a,b);
    }
    return str;
}

module.exports = class Parser{
    static parse(data){
        // 버퍼일수도 있으니 문자열로 변환
        data = data.toString();

        // 주석 제거
        data = removeComments(data.replace(/\r\n/g,'\n').replace(/\r/g,'\n'));

        // header와 content로 분리
        data = data.trim().split(/\n\n+/g);
        var { header,content } = { header:data[0],content:data[1] };
        {
            let arr = [...data];
            arr.shift();
            for(var i in arr){
                arr[i] = arr[i].trim();
            }
            content = arr.join('\n').trim();
        }

        // header는 대소문자를 무시한다.
        var headers = {};
        header = header.trim().split('\n');
        for(var h of header){
            var hh = h.split(':');
            var key = hh[0];
            hh.shift();
            var val = hh.join(':');
            let str = val.trim();
            headers[key.toLowerCase()] = str.trim();
        }

        var commands = [];
        content = content.trim().split('\n');
        for(var c of content){
            var cc = c.trim().split(SPACE_REGEX);
            
            var type = cc.shift().toLowerCase();
            var cmd = {};
            cmd.type = type;
            switch(type){
                case 'c':
                    cmd.cmd = cc;
                break;
                case 't':
                    cmd.timings = cc;
                break;
                case 'l':
                    cmd.end = cc[0] == LINE_END || (() => {
                        if(!cc[0]) return false;
                        let [ tick,ms ] = cc[0].split(':');
                        return !Number.isNaN(parseFloat(tick)) && (!ms || !Number.isNaN(parseFloat(ms)));
                    })();
                    if(cmd.end) cmd.endTime = cc[0] == LINE_END ? 0 : cc[0];
                    cmd.forceStartCount = cc[0] == FORCE_START_COUNT;
                break;
                case 'f':
                    cmd.time = this.parseNumber(cc[0]);
                break;
                case 'n':
                    cmd.lineCode = this.parseNumber(cc[0]);
                break;
                case 's':
                    cmd.sentence = cc.join(' ');
                break;
                case 'u':
                    cmd.sentence = cc.join(' ');
                break;
                case 'p':
                    cmd.params = Parser.parseParams(c.replace(/p( +)/i,''));
                break;
            }
            commands.push(cmd);
        }

        return { headers,commands };
    }

    /*static isRuby(sentence){
        let a = Parser.parseRubySyntax(sentence);
        return !!a.map(e => e[1]).join('');
    }*/
    
    static parseParams(src){
        let key = '';
        let val = '';
        let isVal = false;
        let result = {};
        let isEscape = false;
        if(!src.endsWith(';')) src += ';';
        for(let i in src){
            let chr = src[i];
            if(isEscape){
                isEscape = false;
                isVal ? val += chr : key += chr;
            }else if(chr == ESCAPE){
                isEscape = true;
            }else if(chr == '='){
                isVal = true;
            }else if(chr == ';'){
                if(!isVal){
                    // 값 없이 바로 구분자가 오면 boolean(true)으로 처리
                    result[key] = true;
                }else{
                    result[key] = val;
                }
                isVal = false;
                key = val = '';
            }else isVal ? val += chr : key += chr;
        }
        return result;
    }
    
    // 슬래시(/) 없이 사용하는 경우
    static splitSentence(parsed){
        let str = '';
        let alphabet = true;
        let isEscape = false;
        let connect = false;
        let result = [];
        let srcObj = {
            bracketed:false,
            body:''
        };
        function o(str){
            let obj = {...srcObj};
            obj.body = str;
            return obj;
        }
        for(let i in parsed){
            let txt = parsed[i];
            
            srcObj.bracketed = txt.bracketed;
            for(let j in txt.body){
                // 현재 문자와 이전 문자 결정
                let chr = txt.body[j];
                let nchr = txt.body[j-(-1)];
                
                if(isEscape){
                    isEscape = false;
                    str += chr;
                }else if(chr == ESCAPE){
                    isEscape = true;
                }else if(chr == CONNECT_SYLLABLES){
                    connect = true;
                }else if(chr.match(SPACE_REGEX)){
                    if(str) result.push(o(str));
                    result.push(o(chr));
                    str = '';
                //}else if(chr.match(this.ALPHABET_REGEX)){
                }else if(ALPHABETS.indexOf(chr) >= 0){
                    alphabet = true;
                    str += chr;
                }else if(chr == SPLIT_ALPHABET && alphabet){
                    result.push(o(str)); str = '';
                }else if(chr == TYPE_BRACKET_OPEN){
                    //if(alphabet || nchr.match(this.ALPHABET_REGEX)) str += chr;
                    if(alphabet || ALPHABETS.indexOf(nchr) >= 0) str += chr;
                    else result.push(o(chr));
                }else if(chr == TYPE_BRACKET_CLOSE){
                    if(alphabet) str += chr;
                    else result[result.length-1].body += chr;
                }else{
                    alphabet = false;
                    if(str){
                        result.push(o(str));
                        str = '';
                    }
                    if(SPECIAL_CHARS2.indexOf(result[result.length-1]) >= 0 || connect) result[result.length-1].body += chr;
                    else result.push(o(chr));
                    connect = false;
                }
            }
        }
        if(str) result.push(o(str));

        return result.filter(a => a.body);
    }
    
    static splitSentenceBySlash(parsed){
        let result = [];
        let str = [];
        let srcObj = {
            bracketed:false,
            body:''
        };
        function o(str){
            let obj = {...srcObj};
            obj.body = str;
            return obj;
        }
        for(let i in parsed){
            let txt = parsed[i];
            srcObj.bracketed = txt.bracketed;
            for(let j in txt.body){
                let chr = txt.body[j];
                if(chr == FORCE_SPLIT){
                    result.push(o(str));
                    str = '';
                }else if(chr.match(SPACE_REGEX)){
                    result.push(o(str),o(chr));
                    str = '';
                }else{
                    str += chr;
                }
            }
        }
        if(str) result.push(o(str));

        return result.filter(a => a.body);
    }

    static parseSentence(sentence){
        sentence = sentence.replace(SPACE_REGEX,' '); // 띄어쓰기가 여러개 있던걸 한개로 변환
        let syllables = Parser.parseRubySyntax(sentence); //console.log(syllables)
        if(sentence.match(FORCE_SPLIT)){
            syllables.body = Parser.splitSentenceBySlash(syllables.body);
        }else{
            syllables.body = Parser.splitSentence(syllables.body);
        }
        
        // 전각<->반각 간 변환
        syllables.ruby = syllables.ruby.map(a => {
            for(let i in WIDTH_CONVERT_TABLE){
                a.ruby = strReplaceAll(a.ruby,i,WIDTH_CONVERT_TABLE[i]);
            }
            return a;
        });
        syllables.body = syllables.body.map(a => {
            for(let i in WIDTH_CONVERT_TABLE){
                a.body = strReplaceAll(a.body,i,WIDTH_CONVERT_TABLE[i]);
            }
            return a;
        });
    
        return syllables; // 잘린 거
    }
    
    static #parseMathExpression(num){
        let n = '';
        for(let chr of num){
            if(NUMBER_ALLOWED.indexOf(chr) > -1) n += chr;
        }
        // console.log(n);
        return mathjs.evaluate(n);
    }
    
    static parseNumber(num){
        if(typeof num == 'number') return num;
        else if(typeof num == 'string'){
            if(isNaN(Number(num))) return Parser.#parseMathExpression(num);
            else return Number(num);
        }else return 0;
    }
    
    // 최대공약수(the "g"reatest "c"ommon "d"enominator)
    // 두 수의 최대공약수 계산
    static #doCalcGCD(num1,num2){
        while(num2 != 0){
            let tmp = num1 % num2;
            num1 = num2;
            num2 = tmp;
        }
        return Math.abs(num1);
    }
    
    // 여러 수의 최대공약수를 계산
    static #calcGCD(arr){
        let gcd = Parser.#doCalcGCD(arr.shift(),arr.shift());
        while(arr.length){
            gcd = Parser.#doCalcGCD(gcd,arr.shift());
        }
        return gcd;
    }
    
    static #doParseDuration(time){
        let [ ttt,ms ] = time.split(':');
        let [ ratio,tick ] = ttt.split('@').length > 1 ? ttt.split('@') : [1,ttt];

        let stakato = tick.startsWith('*');
        let ratioo = parseInt(ratio,10);
        if(stakato){
            let tick2 = tick.split('');
            tick2.shift();
            tick = tick2.join('');
        }
        tick = this.#parseMathExpression(tick);
        //if(ms) ms = this.#parseMathExpression(ms);
        return new SingleDuration(tick,ratioo,stakato,false);
    }

    // ,를 사용해 여러개 붙일 수 있음
    // (즉 한글자를 여러번 나눠서 색칠 가능)
    // 비율@시간 형태로 쓸 수 있음
    // 비율은 생략 가능,생략시 기본값은 1
    // - 예시1: 197,*3@121 => 4개로 나눠서 1:3 비율로 색칠
    // - 예시2: 2@60,240,240 => 2:1:1 비율로 색칠
    static parseDuration(time){
        if(typeof time == 'number'){
            return new SingleDuration(
                parseFloat(Parser.parseNumber(time)),
                1,false,false
            );
        }else if(typeof time == 'string'){
            if(time.startsWith('!')){
                // 가사를 멈추는 부분에서는 콤마로 타이밍을 나눌 수 없음
                return SingleDuration(this.#parseMathExpression(time.slice(1)),1,false,true);
            }else{
                let split = time.split(',');
                let parsed = split.map(a => Parser.#doParseDuration(a));
                if(split.length > 1){
                    let gcd = Parser.#calcGCD(parsed.map(a => a.ratio));
                    for(let i in parsed){
                        parsed[i].ratio /= gcd;
                    }
                }
                return parsed;
            }
        }else return new SingleDuration(0,1,false,false);
    }
    
    static parseRubySyntax(text){
        let ruby = [];
        let body = '';
        let status = {
            body:'',
            ruby:'',
            rubyContent:'',
            str:'',
            beforeLength:0,
            afterLength:0,
            bodyBlockClosed:false,
            alphabetLength:0,
            alphabetRuby:false,
            dontCountLength:false
        };
        let specialChars = [...SPECIAL_CHARS,TYPE_BRACKET_OPEN,TYPE_BRACKET_CLOSE,CHANGE_TYPE_START,CHANGE_TYPE_END];
        for(let i in text){
            let chr = text[i];
            if(BODY_BLOCK[chr]){
                if(status.body) throw new SyntaxError(`Already opened the body block at position ${i} (character: '${chr}')`);
                if(status.ruby) throw new SyntaxError(`Already opened the ruby block at position ${i} (character: '${chr}')`);
                status.body = chr;
            }else if(chr == BODY_BLOCK[status.body]){
                status.body = '';
                status.bodyBlockClosed = true;
            }else if(RUBY_BLOCK[chr]){
                if(status.ruby) throw new SyntaxError(`Already opened the ruby block at position ${i} (character: '${chr}')`);
                if(status.body) throw new SyntaxError(`Already opened the body block at position ${i} (character: '${chr}')`);
                if(i == 0) throw new SyntaxError(`Invalid syntax at position ${i} (character: '${chr}')`);

                if(!status.bodyBlockClosed){
                    if(status.alphabetRuby){
                        //알파벳 하나를 묶어서 루비를 지정하는 경우
                        status.alphabetRuby = false;
                        status.beforeLength -= status.alphabetLength;
                        status.afterLength = status.alphabetLength;
                        status.alphabetLength = 0;
                    }else{
                        // 1글자에만 루비를 지정하는 경우
                        status.beforeLength--;
                        status.afterLength = 1;
                    }
                }
                status.bodyBlockClosed = false;
                status.ruby = chr;
            }else if(chr == RUBY_BLOCK[status.ruby]){
                status.ruby = '';
                ruby.push({
                    beforeLength:status.beforeLength,
                    ruby:status.rubyContent,
                    length:status.afterLength
                });
                status.beforeLength = 0;
                status.afterLength = 0;
                status.rubyContent = '';
            }else if(status.bodyBlockClosed){
                throw new SyntaxError(`Invalid syntax at position ${i} (character: '${chr}')`);
            }else{
                if(status.ruby){
                    status.rubyContent += chr;
                }else if(chr == ESCAPE){
                    status.escape = true;
                }else if(chr == WORD_RUBY && !status.body && !status.escape){
                    status.alphabetRuby = true;
                }else{
                    if(chr == CHANGE_TYPE_START) status.dontCountLength = true;
                    else if(chr == CHANGE_TYPE_END) status.dontCountLength = false;
                    body += chr;
                    if(specialChars.indexOf(chr) < 0 && !status.dontCountLength){
                        if(status.body) status.afterLength++;
                        else{
                            status.beforeLength++;
                            if(ALPHABETS.indexOf(chr) >= 0){
                                status.alphabetLength++;
                            }else{
                                status.alphabetLength = 0;
                            }
                        }
                    }
                }
            }
            if(chr != ESCAPE) status.escape = false;
        }

        let bodyArr = [];
        let bracketed = false;
        let bodyContent = '';
        for(let chr of body){
            if(chr == TYPE_BRACKET_OPEN){
                if(bodyContent) bodyArr.push({ bracketed,body:bodyContent });
                bracketed = true;
                bodyContent = '';
            }else if(chr == TYPE_BRACKET_CLOSE){
                if(bodyContent) bodyArr.push({ bracketed,body:bodyContent });
                bracketed = false;
                bodyContent = '';
            }else{
                bodyContent += chr;
            }
        }
        if(bodyContent) bodyArr.push({ bracketed,body:bodyContent });

        return { ruby,body:bodyArr.filter(a => a.body) };
    }
}