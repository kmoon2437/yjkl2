#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const Lyrics = require('../index');

program
.version(require('../package.json').version, '-v, --version')
.usage('<input file> <output file>')
.description('Convert lyrics data(*.txt file) to yjkl file')
.parse(process.argv);

let [ inputfile,outputfile ] = program.args;
let opts = program.opts();

if(!inputfile){
    console.error('Input file(first argument) required');
    process.exit();
}
if(!outputfile){
    console.error('Output file(second argument) required');
    process.exit();
}

const PARAM_REGEX = /\[{(.+?)=(.+?)}\]/g;
const PARAM_PARSE_REGEX = /\[{(.+?)=(.+?)}\]/;
const PREPROCESS_REGEX = /^#([0-9a-zA-Z_$]+?)( *?)(.*?)$/g;

const input = fs.readFileSync(inputfile,'utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n\n');
let output = `File-midi:midi.mid // 적당한 파일명을 지정하세요. 이 부분을 사용하지 않는다면 지워도 좋습니다.
File-album:album.png
File-mr:mr.ogg
File-mv:mv.mkv
MV-timing:0 // 뮤비 시작시간을 밀리초로 지정하세요. mv를 사용하지 않거나 기본값(0)으로 놔둘 거면 지워도 좋습니다.
Meta-layout:0 // 일본곡인 경우 7을 입력하세요. 그 외에는 지워도 좋습니다.
Sync:0 // 가사 전체 싱크(없어도 됨)

c bpm 120 0 // 적당한 bpm을 지정하세요.`;
let verseEnded = true;

for(let verse of input){
    let lines = verse.split('\n');
    
    // 전처리
    let preprocess = {
        param:{}
    };
    let preprocessed = [];
    for(let i in lines){
        if(lines[i].match(PREPROCESS_REGEX)){
            let [ cmd,...args ] = lines[i].slice(1).split(/ +/g);
            if(cmd == 'param'){
                preprocess.param[args[0]] = args[1];
                switch(args[0]){
                    case 'p':
                        if(args[1] == 0) delete preprocess.param.p;
                    break;
                }
            }
        }else{
            let a = lines[i];
            if(Object.keys(preprocess.param).length){
                a = `[{${Object.entries(preprocess.param).map(a => a.join('=')).join('}][{')}}]${a}`;
            }
            preprocessed.push(a);
        }
    }
    
    //console.log(preprocessed);
    
    for(let line of preprocessed){
        let [ sentence,sub ] = line.split('::');
        let sentence2 = sentence.replace(PARAM_REGEX,'');
        let syllLength = Lyrics.Parser.parseSentence(sentence2).body.filter(a => a.body.trim()).length;
        if(!verseEnded) output += '\nl';
        verseEnded = false;
        let matches,isP,params = {};
        if(matches = sentence.match(PARAM_REGEX)){
            for(let raw of matches){
                let [ key,value ] = raw.match(PARAM_PARSE_REGEX).slice(1);
                switch(key.toLowerCase()){
                    case 'p': params.style = value; isStyled = true; console.log('"p" is deprecated. use "style" instead.'); break;
                    case 'p': params.style = value; isStyled = true; break;
                    case 'flag': if(value == 'upper'){ params.upper = true; } console.log('"flag" is deprecated.'); break;
                    case 'upper': params.upper = true; break;
                }
            }
        }
        if(!isStyled && sentence2.startsWith('(') && sentence2.endsWith(')')){
            params.style = -1;
            sentence2 = sentence2.slice(1,-1);
        }
        
        if(Object.keys(params).length) output += '\np ';
        let parr = [];
        for(let i in params){
            parr.push(`${i}=${params[i]}`);
        }
        output += parr.join(';');

        output += `\ns ${sentence2}`;
        if(sub) output += `\nu ${sub}`;

        output += `\nf 0`;
        output += `\nt 0`;
        //output += '\n'+JSON.stringify(syllables)
    }
    output += '\nl -';
    verseEnded = true;
}

fs.writeFileSync(outputfile,output,'utf8');