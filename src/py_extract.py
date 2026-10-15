import ast, json, sys

def sig_for(n):
    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
        args = ast.unparse(n.args)
        prefix = "async def" if isinstance(n, ast.AsyncFunctionDef) else "def"
        return f"{prefix} {n.name}({args})"
    if isinstance(n, ast.ClassDef):
        bases = ", ".join(ast.unparse(b) for b in n.bases)
        return f"class {n.name}({bases})" if bases else f"class {n.name}"
    if isinstance(n, ast.Assign):
        targets = ", ".join(ast.unparse(t) for t in n.targets)
        return f"{targets} = {ast.unparse(n.value)[:80]}"
    if isinstance(n, ast.AnnAssign):
        t = ast.unparse(n.target)
        a = f": {ast.unparse(n.annotation)}" if n.annotation else ""
        v = f" = {ast.unparse(n.value)[:80]}" if n.value else ""
        return f"{t}{a}{v}"
    return ""

def doc_of(n):
    if isinstance(n, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
        return ""
    d = ast.get_docstring(n)
    return d or ""

def kind_of(n):
    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return "function"
    if isinstance(n, ast.ClassDef):
        return "class"
    if isinstance(n, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
        return "const"
    return None

def main():
    path = sys.argv[1]
    src = open(path, encoding="utf-8-sig").read()
    tree = ast.parse(src)
    out = []
    for n in tree.body:
        k = kind_of(n)
        if not k:
            continue
        if isinstance(n, (ast.Assign, ast.AnnAssign)):
            names = []
            if isinstance(n, ast.Assign):
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        names.append(t.id)
            else:
                if isinstance(n.target, ast.Name):
                    names.append(n.target.id)
            name = ", ".join(names) if names else "(assignment)"
        else:
            name = n.name
        out.append({
            "kind": k,
            "name": name,
            "doc": doc_of(n),
            "sig": sig_for(n)[:160],
        })
    print(json.dumps(out))

if __name__ == "__main__":
    main()
