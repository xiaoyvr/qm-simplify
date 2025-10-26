import { describe, it } from "node:test";
import assert from "node:assert";
import { parseExpression } from '@babel/parser';
import  { generate } from '@babel/generator';
import { buildQM, type ExprConfig } from "../src";
import * as t from "@babel/types";


describe("buildQM", () => {
  const babelConfig: ExprConfig<t.Expression> = {
    dtorAnd: (expr) => {
      return t.isLogicalExpression(expr) && expr.operator === "&&"? 
        [true, { lhs: expr.left, rhs: expr.right }] : 
        [false];
    },
    dtorOr: (expr) => {
      return t.isLogicalExpression(expr) && expr.operator === "||"? 
        [true, { lhs: expr.left, rhs: expr.right }] : 
        [false];
    },
    dtorNot: (expr) => {
      return t.isUnaryExpression(expr) && expr.operator === "!"? 
        [true, { operand: expr.argument }] : 
        [false];
    },
    dtorliteral: (expr) => {
      return t.isBooleanLiteral(expr)? 
        [true, { value: expr.value }] : 
        [false];
    },
    equal: (lhs, rhs) => t.isNodesEquivalent(lhs, rhs),
    ctorAnd: (lhs, rhs) => t.logicalExpression("&&", lhs, rhs),
    ctorOr: (lhs, rhs) => t.logicalExpression("||", lhs, rhs),
    ctorNot: (operand) => t.unaryExpression("!", operand),
    ctorLiteral: (value) => t.booleanLiteral(value),
  };
  const qm = buildQM(babelConfig);


  const cases = [
    ["A", "A"],
    ["!!A", "A"],
    [`!(!(A))`, `A`],
    [`!(!(!(A)))`, `!A`],
    [`!(!(!(!(A))))`, `A`],
    ["A && A", "A"],
    ["A && B && A", "A && B"],
    ["A || B || A", "B || A"],
    ["A || B && A", "A"],
    ["A && !A", "false"],
    ["A || !A", "true"],
    ["A && B || !A", "!A || B"],
    ["(A || B) && !A", "B && !A"],
    ["A || (B && C)", "B && C || A"],
    ["A || (B && !A)", "B || A"],
    [`true && A`, `A`],
    [`true && true && A`, `A`],
    [`true && true && true && A && true`, `A`],
    ["!(true && !(false || A))", "A"],
    ["A || A", "A"],
    ["A || A && A", "A"],
    ["A || !A", "true"],
    ["A && !A", "false"],
    ["A || B || A", "B || A"], 
    ["A && (B || !A)", "A && B"],
    ["A || (B || !A)", "true"],
    ["A && (B && !A)", "false"],
    ["A || (B && !A)", "B || A"],

  ];
  for (const [input, expected] of cases) {  

    it(`should simplify [${input}] to [${expected}]`, () => {
      const expr = qm.simplify(parseExpression(input!));
      const result = generate(expr, { jsescOption:{ quotes: 'single' } });
      assert.equal(result.code, expected);
    });
  }
});