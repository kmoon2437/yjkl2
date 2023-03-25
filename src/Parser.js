const mathExpressionParser = require('./mathExpressionParser');

module.exports = class Parser{
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
    
    static isValidNumber(num){
        if(typeof num == 'number') return true;
        else if(typeof num == 'string'){
            if(isNaN(Number(num))){
                try{
                    Parser.#parseMathExpression(num);
                    return true;
                }catch(e){
                    return false;
                }
            }else return true;
        }else return false;
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
}