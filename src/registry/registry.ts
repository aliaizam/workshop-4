import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import crypto from "crypto";

type Payload = {
  result: string; 
};

export type Node = { nodeId: number; pubKey: string; privateKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
  privateKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

const nodeRegistry: Node[] = [];

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", (req, res) => {
    const { nodeId, pubKey, privateKey } = req.body as RegisterNodeBody;
  
    const existingNode = nodeRegistry.find((node) => node.nodeId === nodeId);
    if (existingNode) {
      return res.status(400).json({ error: "Node already registered" });
    }
  
    // Enregistrement du nœud
    nodeRegistry.push({ nodeId, pubKey, privateKey });
    return res.status(200).json({ message: "Node registered successfully" });
  });

  _registry.get("/getPrivateKey/:nodeId", (req, res) => {
    const { nodeId } = req.params;

    // Vérification si la paire de clés existe pour le nœud spécifié
    const existingNode = nodeRegistry.find((node) => node.nodeId === parseInt(nodeId));
    if (!existingNode) {
      return res.status(404).json({ error: "Node not found" });
    }

    // Renvoyer la clé privée du nœud spécifié en format base64
    const privateKeyBase64 = existingNode.privateKey.toString();
    return res.json({ result: privateKeyBase64 });
  });

  _registry.get('/getNodeRegistry', (req, res) => {
    const body: GetNodeRegistryBody = { nodes: nodeRegistry };
    res.json(body);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
