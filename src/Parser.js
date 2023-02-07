const mathExpressionParser = require('./mathExpressionParser');

const ALPHABETS = require('./alphabets'); // 영어,라틴문자,키릴문자,그리스문자 등등등
const WIDTH_CONVERT_TABLE = require('./widthConvert');
const BODY_BLOCK = { '[':']' };
const RUBY_BLOCK = { '{':'}','<':'>' };
const FORCE_SPLIT = '/';
const CONNECT_SYLLABLES = '*';
const SPLIT_ALPHABET = '_';
const ESCAPE = '\\';
const SPACE_REGEX = /[\u0020\u00a0\u3000]+/g; // \u0020(일반 띄어쓰기)와 \u00a0(nbsp), \u3000(전각 띄어쓰기)를 모두 인식
const TYPE_BRACKET_OPEN = '(';
const TYPE_BRACKET_CLOSE = ')';
const WORD_RUBY = ':';
const SPECIAL_CHARS = [FORCE_SPLIT,CONNECT_SYLLABLES,SPLIT_ALPHABET];
const SPECIAL_CHARS2 = [...Object.keys(BODY_BLOCK),TYPE_BRACKET_OPEN];

module.exports = class Parser{
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
        
        // 전각<->반각 간 변환은 걍 안함
        /*syllables.ruby = syllables.ruby.map(a => {
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
        });*/
    
        return syllables; // 잘린 거
    }
    
    static #parseMathExpression(num){
        try{
            return mathExpressionParser.parse(num);
        }catch(e){ // 에러 시 0 리턴
            // stderr에 메세지를 출력하므로
            // stdout에는 영향을 미치지 않음
            console.error(e);
            return 0;
        }
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
    static calcGCD(arr){
        arr = [...arr];
        if(arr.length < 2) return arr[0];
        let gcd = Parser.#doCalcGCD(arr.shift(),arr.shift());
        while(arr.length){
            gcd = Parser.#doCalcGCD(gcd,arr.shift());
        }
        return gcd;
    }

    static parseRubySyntax(text,splitLengths = null){
        let ruby = [];
        let body = [''];
        let status = {
            body:'',
            ruby:'',
            rubyContent:'',
            str:'',
            isEscape:false,
            beforeLength:0,
            afterLength:0,
            bodyBlockClosed:false,
            alphabetLength:0,
            alphabetRuby:false,
            dontCountLength:false,
            splitLength:splitLengths?.shift()
        };
        //console.log(splitLengths)
        if(!(splitLengths instanceof Array) || splitLengths.reduce((a,b) => a+b,0) < text.length-status.splitLength) status.splitLength = Infinity;
        for(let i in text){
            let chr = text[i];
            //console.log(chr,i,status.splitLength);
            if(i >= status.splitLength){
                body.push('');
                status.splitLength += splitLengths.shift();
            }
            if(status.isEscape){
                if(status.ruby){
                    status.rubyContent += chr;
                }else{
                    body[body.length-1] += chr;
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
            }else if(BODY_BLOCK[chr]){
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
                    status.isEscape = true;
                }else if(chr == WORD_RUBY && !status.body){
                    status.alphabetRuby = true;
                }else{
                    body[body.length-1] += chr;
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
            if(chr != ESCAPE) status.isEscape = false;
        }

        return { ruby,body };
    }
}