export type ExprConfig<T> = {
  dtorAnd: (expr: T) => [boolean, {lhs: T, rhs: T}?];
  dtorOr: (expr: T) => [boolean, {lhs: T, rhs: T}?];
  dtorNot: (expr: T) => [boolean, {operand: T}?];
  dtorliteral: (expr: T) => [boolean, {value: boolean}?];
  equal: (lhs: T, rhs: T) => boolean;
  ctorAnd: (lhs: T, rhs: T) => T;
  ctorOr: (lhs: T, rhs: T) => T;
  ctorNot: (operand: T) => T;
  ctorLiteral: (value: boolean) => T;
}

export function buildQM<T>(cfg: ExprConfig<T>) {

  type Product = {
    atoms: {
      expr: T;
      value: boolean;
    }[];
  };
  type SOP = Product[];
  
  const Empty: SOP = [];
  const Full: SOP = [{ atoms: [] }];

  function and(leftSOP: SOP, rightSOP: SOP): SOP {
    let products: Product[] = [];
    for (const leftProduct of leftSOP) {
      for (const rightProduct of rightSOP) {
        const product = andProducts(leftProduct, rightProduct);
        if (product) {
          products = orProducts(products, product);
        }
      }
    }
    return products;
  }

  function or(leftSOP: SOP, rightSOP: SOP): SOP {
    let products: Product[] = [...leftSOP];
    for (const rightProduct of rightSOP) {
      products = orProducts(products, rightProduct);
    }
    return products;
  }
  
  function andProducts(leftProduct: Product, rightProduct: Product): Product | null {
    const resultAtoms: ({ expr: T, value: boolean } | '-')[] = [...leftProduct.atoms, ...rightProduct.atoms];
    for (const [_i, leftAtom] of leftProduct.atoms.entries()) {
      for (const [j, rightAtom] of rightProduct.atoms.entries()) {
        if (cfg.equal(leftAtom.expr, rightAtom.expr)) {
          if (leftAtom.value && rightAtom.value) {
            resultAtoms[leftProduct.atoms.length + j] = "-";
          } else {
            return null;
          }
        }
      }
    }
    return {
      atoms: resultAtoms.filter(atom => atom !== '-') satisfies { expr: T, value: boolean }[],
    };
  }

  function orProducts(products: Product[], newProduct: Product): Product[] {
    const result: Product[] = [...products];
    for (const product of products) {
      if (implies(product, newProduct)) {
        return result;
      }
    }
    return [...result, newProduct];
  }

  function implies(leftProduct: Product, rightProduct: Product): boolean {
    return leftProduct.atoms.every(atom =>
      rightProduct.atoms.some(a =>
        cfg.equal(atom.expr, a.expr) && atom.value === a.value));
  }

  function not(sop: SOP): SOP {
    if (sop.length === 0) {
      return Full;
    }
  
    const [first, ...rest] = sop;
    if (first!.atoms.length === 0) {
      return Empty;
    }
  
    const result = rest.reduce((acc: Product[], product) => {
      let resultProducts: Product[] = [];
      for (const accProduct of acc) {
        for (const atom of product.atoms) {
          const newProduct = andProducts(accProduct, { atoms: [{ expr: atom.expr, value: !atom.value }] });
          if (newProduct) {
            resultProducts = orProducts(resultProducts, newProduct);
          }
        }
      }
      return resultProducts;
    }, notProducts(first!));
  
    return result;
  }
  
  function notProducts(product: Product): Product[] {
    return product.atoms.map(atom => ({ atoms: [{ expr: atom.expr, value: !atom.value }] }));
  }
  

  function from(expr: T): SOP {
    {
      const [ok, result] = cfg.dtorAnd(expr);
      if (ok) {
        return and(from(result!.lhs), from(result!.rhs));
      }  
    }
    {
      const [ok, result] = cfg.dtorOr(expr);
      if (ok) {
        return or(from(result!.lhs), from(result!.rhs));
      }  
    }
    {
      const [ok, result] = cfg.dtorNot(expr);
      if (ok) {
        return not(from(result!.operand));
      }  
    }
    {
      const [ok, result] = cfg.dtorliteral(expr);
      if (ok) {
        return result!.value ? Full : Empty;
      }  
    }
  
    return [{ atoms: [{ expr, value: true }] }];
  }

  function to(sop: SOP): T {
    const result = sop.reduce((acc: T, product, index) => {
      const right = product.atoms.reduce((acc1: T, atom, index1) => {
        const right1 = atom.value ? atom.expr : cfg.ctorNot(atom.expr);
        if (index1 === 0) return right1;
        return cfg.ctorAnd(acc1, right1);
      }, cfg.ctorLiteral(true));
      if (index === 0) return right;
      return cfg.ctorOr(acc, right);
    }, cfg.ctorLiteral(false));
    return result;
  }

  function qmSop(sop: SOP): SOP {
    const allExprs = sop.flatMap(product => product.atoms.map(atom => atom.expr));
    const orderedExprs = allExprs.filter((expr, index) =>
      allExprs.findIndex(e => cfg.equal(e, expr)) === index);
    if (orderedExprs.length === 0) {
      return sop;
    }
    
  
    const cubes: Cube[] = sop.map(product =>
      orderedExprs.map(expr => {
        const atom = product.atoms.find(atom => cfg.equal(atom.expr, expr));
        return atom ? (atom.value ? '1' : '0') : '-';
      })
    );
  
    const { onSet, minterms } = onSetFromCubes(cubes);
    const primesWithConver = getPrimesWithCover(minterms.map(prime => ({ cube: prime, onSet: new Set([toIndex(prime, prime.length)]) })));
    const coverPrimes = selectCover(onSet, primesWithConver);
  
    const result = coverPrimes.map(cube => {
      const atoms = cube.map((bit, index) => {
        if (bit === '-') {
          return null;
        }
        return { expr: orderedExprs[index]!, value: bit === '1' };
      }).filter(atom => atom !== null);
  
      return { atoms };
    });
    return result;  
  }
  
  return {
    simplify: (expr: T) => to(qmSop(from(expr)))
  };
}



type Bit = '0' | '1' | '-';
type Cube = Bit[];

function getPrimesWithCover(cubesWithOnSet: {cube: Cube, onSet: Set<number>}[]): {cube: Cube, onSet: Set<number>}[] {
  if (cubesWithOnSet.length === 0) {
    return [];
  }
  const combined = [];
  const usedIndex = new Set<number>();
  const [_, ...rest] = cubesWithOnSet;
  for (const [i1, {cube: cube1, onSet: onSet1}] of cubesWithOnSet.entries()) {
    for (const [i2, {cube: cube2, onSet: onSet2}] of rest.entries()) {
      const result = canCombine(cube1, cube2);
      if (result.ok) {
        usedIndex.add(i1);
        usedIndex.add(i2+1);
        combined.push({ cube: result.out, onSet: new Set([...onSet1, ...onSet2]) });
      }  
    }
  }
  const primesWithOnSet = cubesWithOnSet.filter((_, i) => !usedIndex.has(i));
  const dedupCombined = dedupCubesWithOnSet(combined);
  if(combined.length === 0) {
    return primesWithOnSet;
  }
  return dedupCubesWithOnSet([...primesWithOnSet, ...getPrimesWithCover(dedupCombined)]);
}

function dedupCubesWithOnSet(cs: {cube: Cube, onSet: Set<number>}[]): {cube: Cube, onSet: Set<number>}[] {
  const seen = new Set<string>();
  const out: {cube: Cube, onSet: Set<number>}[] = [];
  for (const {cube, onSet} of cs) { 
    const k = cube.join(''); 
    if (!seen.has(k)) { 
      seen.add(k); 
      out.push({cube, onSet}); 
    }
  }
  return out;
}


function canCombine(a: Cube, b: Cube): { ok: true, out: Cube } | { ok: false } {
  let diff = 0, pos = -1;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (x === '-' || y === '-') return { ok: false };
    diff++; pos = i;
    if (diff > 1) return { ok: false };
  }
  if (diff !== 1) return { ok: false };
  const out = a.slice(); out[pos] = '-';
  return { ok: true, out };
}

function onSetFromCubes(cubes: Cube[]) {
  const map = new Map<number, Cube>();
  for (const cube of cubes) {
    for (const minterm of toMinterms(cube)) {
      map.set(toIndex(minterm, cube.length), minterm);
    }
  }
  const sortedKeys = [...map.keys()].sort((a, b) => a - b);

  return { onSet: sortedKeys, minterms: sortedKeys.map(k => map.get(k)!) };
}

function toMinterms(cube: Cube) {
  if (cube.length === 0) {
    return [];
  }

  return cube.reduce((acc: Cube[], bit) =>
    ['1', '0'].includes(bit) ?
      acc.map(c => [...c, bit]) :
      acc.map(c => [...c, '1' as Bit]).concat(acc.map(c => [...c, '0']))
    , [[]]);
}

function toIndex(minterm: Cube, n: number): number {
  return minterm.reduce((acc, bit, index) => acc + (bit === '1' ? 1 << (n - 1 - index) : 0), 0);
}

function selectCover(onSet: number[], primesWithCover: {cube: Cube, onSet: Set<number>}[]): Cube[] {
  const remaining = new Set(onSet);
  const selected: {cube: Cube, onSet: Set<number>}[] = [];

  while (true) {
    let pick: {cube: Cube, onSet: Set<number>} | null = null;
    for (const onIndex of remaining) {
      const covering = [...primesWithCover].filter(({onSet}) => onSet.has(onIndex));
      if (covering.length === 1) { 
        pick = covering[0]!;
        break; 
      }
    }
    if (!pick)  {
      break;
    }
    selected.push(pick);
    for (const m of pick.onSet) {
      remaining.delete(m);
    }
  }

  while (remaining.size > 0) {
    let best: {cube: Cube, onSet: Set<number>} | null = null, bestGain = -1;
    for (const primeWithCover of primesWithCover) {
      if (selected.includes(primeWithCover)) 
        continue;
      const gain = [...primeWithCover.onSet].filter(m => remaining.has(m)).length;
      if (gain > bestGain) { 
        bestGain = gain; 
        best = primeWithCover; 
      }
    }
    if (!best) 
      break;

    selected.push(best);
    for (const m of best.onSet) 
      remaining.delete(m);
  }
  
  return selected.map(k => k.cube);
}
