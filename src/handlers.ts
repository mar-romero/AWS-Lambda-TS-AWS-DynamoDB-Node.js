import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from 'aws-sdk'
import { abort } from "process";
import { v4 } from "uuid";
import * as yup from "yup";

const docClient = new AWS.DynamoDB.DocumentClient()
const tableName = 'ProductsTable'

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown>) {
    super(JSON.stringify(body))
  }
}

const headers = {
  'content-type': "application/json"
}

const fetchProductById = async (id: string) => {
  const output = await docClient.get({
    TableName: tableName,
    Key: {
      productID: id
    }
  }).promise()
  if (!output.Item) {
    throw new HttpError(404, { error: 'Not Found' })
  }
  return output.Item;
}

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors:e.errors
      })
    }
  }
  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: `Invalid request body format: ${e.message}`
      })
      
    }
  }
  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message
    }
  }
  throw e
}



const schema = yup.object().shape({
  name: yup.string().required(),
  description: yup.string().required(),
  price: yup.number().required(),
  available:yup.bool().required()
})

export const createProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string)
    await schema.validate(reqBody,{abortEarly:false})
    const product = {
      ...reqBody,
      productID: v4(),
    }
    await docClient.put({
      TableName: tableName,
      Item: product,
    }).promise()

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(
        {
          product
        },
        null,
        2,
      ),
    }
  } catch (e) {
    return handleError(e)
  }
};


export const getProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const product = await fetchProductById(event.pathParameters?.id as string)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product)
    }
  } catch (e) {
    return handleError(e)
  }
}

export const updateProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string
    await fetchProductById(id)
    const reqBody = JSON.parse(event.body as string)
    await schema.validate(reqBody,{ abortEarly: false })
    const product = {
      ...reqBody,
      productID: id,
    }
    await docClient.put({
      TableName: tableName,
      Item: product,
    }).promise()
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product)
    };
  } catch (e) {
    return handleError(e)
  }
}

export const deleteProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string
    await fetchProductById(id)
    await docClient.delete({
      TableName: tableName,
      Key: {
        productID: id,
      }
    }).promise()
    return {
      statusCode: 204,
      headers,
      body: "Product delete"
    }
  } catch (e) {
    return handleError(e)
  }
}

export const listProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output.Items),
  };
}