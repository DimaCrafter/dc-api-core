const ts = require('typescript');


class Transformer {
	/**
	 * @param {ts.TransformationContext} ctx
	 * @param {ts.SourceFile} sourceFile
	 */
	constructor (ctx, sourceFile) {
		this.ctx = ctx;
		this.sourceFile = sourceFile;

		this.httpClassVisit = this.httpClassVisit.bind(this);
		this.httpMemberVisit = this.httpMemberVisit.bind(this);
	}

	/** @returns {ts.SourceFile} */
	run () {
		if (!this.sourceFile.fileName.includes('controllers')) {
			return this.sourceFile;
		}

		// @ts-ignore
		return ts.visitNode(this.sourceFile, rootNode => {
			return ts.visitEachChild(rootNode, this.httpClassVisit, this.ctx);
		});
	}

	static printNode (node) {
		const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
		printer.printFile(node);
		return node;
	}

	httpClassVisit (node) {
		if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
			return node;
		}

		for (const clause of node.heritageClauses) {
			for (const type of clause.types) {
				const extendedType = type.getText(this.sourceFile);
				if (extendedType == 'HttpController') {
					return ts.visitEachChild(node, this.httpMemberVisit, this.ctx);
				}
			}
		}

		return node;
	}

	httpMemberVisit (node) {
		if (ts.isMethodDeclaration(node)) {
			const validatedStatements = [];
			for (const param of node.parameters) {
				const statement = this.createValidatedVariable(param);
				if (statement) {
					validatedStatements.push(statement);
				}
			}

			if (validatedStatements.length != 0) {
				// async is required for validation
				let { modifiers } = node;
				if (!modifiers) {
					modifiers = this.ctx.factory.createNodeArray([
						this.ctx.factory.createModifier(ts.SyntaxKind.AsyncKeyword)
					]);
				} else if (!modifiers.some(m => m.kind == ts.SyntaxKind.AsyncKeyword)) {
					modifiers = this.ctx.factory.createNodeArray([
						this.ctx.factory.createModifier(ts.SyntaxKind.AsyncKeyword),
						...modifiers
					]);
				}

				let { body } = node;
				if (!body) return node;

				body = this.ctx.factory.updateBlock(body, [
					...validatedStatements,
					...body.statements
				]);

				return this.ctx.factory.updateMethodDeclaration(
					node,
					modifiers,
					node.asteriskToken,
					node.name,
					node.questionToken,
					node.typeParameters,
					[],
					node.type,
					body
				);
			}
		}

		return node;
	}

	/**
	 * @param {ts.ParameterDeclaration} param
	 * @returns
	 */
	createValidatedVariable (param) {
		if (!param.type || !ts.isTypeReferenceNode(param.type) || !param.type.typeArguments) {
			return;
		}

		// todo? ensure type source
		const paramName = param.name.getText(this.sourceFile);
		const kind = param.type.typeName.getText(this.sourceFile);

		// typeArgument: TypeReference { Identifier }
		const typeId = param.type.typeArguments[0].getChildAt(0);
		if (!ts.isIdentifier(typeId)) {
			return;
		}

		// var <paramName> = await this.__validate<kind>(<type>);
		return this.ctx.factory.createVariableStatement(
			undefined,
			[this.ctx.factory.createVariableDeclaration(
				paramName,
				undefined,
				undefined,
				this.ctx.factory.createAwaitExpression(
					this.ctx.factory.createCallExpression(
						this.ctx.factory.createPropertyAccessExpression(
							this.ctx.factory.createThis(),
							this.ctx.factory.createIdentifier('__validate' + kind)
						),
						undefined,
						[typeId]
					)
				)
			)]
		);
	}
}

module.exports = Transformer;
