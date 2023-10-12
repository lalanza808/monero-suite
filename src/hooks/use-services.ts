import { useEffect, useMemo, useState } from "react";
import {
  PropertiesServices,
  PropertiesVolumes,
} from "../../node_modules/compose-spec-schema/lib/type";

export interface Service {
  name: string;
  description: string;
  checked: boolean | string;
  required: boolean;
  bash?: string;
  code: PropertiesServices;
  volumes?: PropertiesVolumes;
}

export interface ServiceMap {
  [key: string]: Service;
}

export const useServices = () => {
  const [isMoneroPublicNode, setIsMoneroPublicNode] = useState(true);
  const [moneroNodeDomain, setMoneroNodeDomain] = useState(
    "node.monerosuite.org"
  );
  const [isPrunedNode, setIsPrunedNode] = useState(true);
  const [p2PoolMode, setP2PoolMode] = useState("none");
  const [p2PoolPayoutAddress, setP2PoolPayoutAddress] = useState(
    "48oc8c65B9JPv6FBZBg7UN9xUYmxux6WfEh61WBoKca7Amh7r7bnCZ7JJicLw7UN3DEgEADwqrhwxGBJazPZ14PJGbmMyXX"
  );
  const [p2PoolMiningThreads, setP2PoolMiningThreads] = useState(0);
  const [isTor, setIsTor] = useState(false);
  const [isWatchtower, setIsWatchtower] = useState(false);
  const [isMoneroblock, setIsMoneroblock] = useState(false);
  const [isMoneroblockLogging, setIsMoneroblockLogging] = useState(true);
  const [moneroBlockDomain, setMoneroBlockDomain] = useState(
    "explorer.monerosuite.org"
  );
  const [isOnionMoneroBlockchainExplorer, setIsOnionMoneroBlockchainExplorer] =
    useState(false);
  const [
    onionMoneroBlockchainExplorerDomain,
    setOnionMoneroBlockchainExplorerDomain,
  ] = useState("");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [grafanaDomain, setGrafanaDomain] = useState("grafana.monerosuite.org");
  const [isAutoheal, setIsAutoheal] = useState(false);
  const [isXmrig, setIsXmrig] = useState(false);
  const [isTraefik, setIsTraefik] = useState(false);

  useEffect(() => {
    if (isTraefik) {
      setGrafanaDomain("grafana.monerosuite.org");
    } else {
      setGrafanaDomain("localhost:3000");
    }
  }, [isTraefik]);

  const services = useMemo<ServiceMap>(
    () =>
      ({
        monerod: {
          name: "Monero Node",
          description:
            "The Monero daemon, monerod, is the core software that runs the Monero network. It is responsible for storing the blockchain and synchronizing transactions.",
          checked: true,
          required: true,
          bash: isMoneroPublicNode
            ? `
# Allow monerod p2p port and restricted rpc port
sudo ufw allow 18080/tcp 18089/tcp`
            : undefined,
          volumes: {
            bitmonero: {},
            grafana: {},
            prometheus: {},
          },
          code: {
            monerod: {
              image: "sethsimmons/simple-monerod:latest",
              restart: "unless-stopped",
              container_name: "monerod",
              volumes: ["bitmonero:/home/monero"],
              ports: [
                ...(isMoneroPublicNode
                  ? ["18080:18080"]
                  : ["127.0.0.1:18080:18080"]),
                ...(p2PoolMode !== "none"
                  ? isMoneroPublicNode
                    ? ["18084:18084"]
                    : ["127.0.0.1:18084:18084"]
                  : []),
                ...(isMoneroPublicNode
                  ? ["18089:18089"]
                  : ["127.0.0.1:18089:18089"]),
              ],
              command: [
                "--rpc-restricted-bind-ip=0.0.0.0",
                "--rpc-restricted-bind-port=18089",
                "--rpc-bind-ip=0.0.0.0",
                "--rpc-bind-port=18083", // unrestricted port for internal use
                "--confirm-external-bind",
                "--enable-dns-blocklist",
                "--no-igd",
                "--out-peers=50",
                ...(isPrunedNode ? ["--prune-blockchain"] : []),
                ...(isMoneroPublicNode ? ["--public-node"] : []),
                ...(p2PoolMode !== "none"
                  ? ["--zmq-pub=tcp://0.0.0.0:18084"]
                  : []),
              ],
              labels: isTraefik
                ? {
                    "traefik.enable": "true",
                    "traefik.http.routers.monerod.rule": `Host(\`${moneroNodeDomain}\`)`,
                    "traefik.http.routers.monerod.entrypoints": "websecure",
                    "traefik.http.routers.monerod.tls.certresolver":
                      "monerosuite",
                    "traefik.http.services.monerod.loadbalancer.server.port":
                      "18089",
                  }
                : undefined,
            },
          },
        },
        p2pool: {
          name: "P2Pool",
          description:
            "P2Pool is a decentralized mining pool that works by creating a peer-to-peer network of miner nodes. For Moneros decentralization it is better to use P2Pool, instead of a centralized mining pool.",
          checked: p2PoolMode,
          required: false,
          volumes: {
            "p2pool-data": {},
          },
          bash:
            p2PoolMode === "mini"
              ? `
# Allow p2pool mini p2p port
sudo ufw allow 37888/tcp
# Allow p2pool stratum port
sudo ufw allow 3333/tcp`
              : p2PoolMode === "full"
              ? `
# Allow p2pool p2p port
sudo ufw allow 37889/tcp
# Allow p2pool stratum port
sudo ufw allow 3333/tcp`
              : undefined,
          code: {
            p2pool: {
              image: "sethsimmons/p2pool:latest",
              restart: "unless-stopped",
              container_name: "p2pool",
              tty: true,
              stdin_open: true,
              volumes: [
                "p2pool-data:/home/p2pool",
                "/dev/hugepages:/dev/hugepages:rw",
              ],
              ports: [
                "3333:3333",
                ...(p2PoolMode === "mini" ? ["37888:37888"] : []),
                ...(p2PoolMode === "full" ? ["37889:37889"] : []),
              ],
              command: [
                `--wallet ${p2PoolPayoutAddress}`,
                "--stratum 0.0.0.0:3333",
                `--p2p 0.0.0.0:${p2PoolMode === "mini" ? "37888" : "37889"}`,
                "--rpc-port 18089",
                "--zmq-port 18084",
                "--host monerod",
                ...(p2PoolMode === "mini"
                  ? ["--addpeers node.portemonero.com:37888", "--mini"]
                  : p2PoolMode === "full"
                  ? [
                      "--addpeers 65.21.227.114:37889,node.sethforprivacy.com:37889",
                    ]
                  : []),
                ...(p2PoolMiningThreads > 0
                  ? [`--start-mining ${p2PoolMiningThreads}`]
                  : []),
              ].join(" "),
            },
          },
        },
        moneroblock: {
          name: "Moneroblock",
          description:
            "Moneroblock is a self-hostable block explorer for monero",
          checked: isMoneroblock,
          required: false,
          code: {
            moneroblock: {
              image: "sethsimmons/moneroblock:latest",
              restart: "unless-stopped",
              container_name: "moneroblock",
              ports: ["127.0.0.1:31312:31312"],
              command: ["--daemon", "monerod:18089"],
              labels: isTraefik
                ? {
                    "traefik.enable": "true",
                    "traefik.http.routers.moneroblock.rule": `Host(\`${moneroBlockDomain}\`)`,
                    "traefik.http.routers.moneroblock.entrypoints": "websecure",
                    "traefik.http.routers.moneroblock.tls.certresolver":
                      "monerosuite",
                    "traefik.http.services.moneroblock.loadbalancer.server.port":
                      "31312",
                  }
                : undefined,
              logging: !isMoneroblockLogging
                ? {
                    driver: "none",
                  }
                : undefined,
            },
          },
        },
        "onion-monero-blockchain-explorer": {
          name: "Onion Monero Blockchain Explorer",
          description:
            "Onion Monero Blockchain Explorer allows you to browse Monero blockchain. It uses no JavaScript, no cookies and no trackers.",
          checked: isOnionMoneroBlockchainExplorer,
          required: false,
          code: {
            onionMoneroBlockchainExplorer: {
              image: "vdo1138/xmrblocks:latest",
              restart: "unless-stopped",
              container_name: "onion-monero-blockchain-explorer",
              ports: ["127.0.0.1:8081:8081"],
              volumes: ["bitmonero:/home/monero/.bitmonero"],
              depends_on: ["monerod"],
              command: [
                "./xmrblocks --enable-json-api --enable-autorefresh-option --enable-emission-monitor --daemon-url=monerod:18089 --enable-pusher",
              ],
              labels: isTraefik
                ? {
                    "traefik.enable": "true",
                    "traefik.http.routers.onion-monero-blockchain-explorer.rule": `Host(\`${onionMoneroBlockchainExplorerDomain}\`)`,
                    "traefik.http.routers.onion-monero-blockchain-explorer.entrypoints":
                      "websecure",
                    "traefik.http.routers.onion-monero-blockchain-explorer.tls.certresolver":
                      "monerosuite",
                    "traefik.http.services.onion-monero-blockchain-explorer.loadbalancer.server.port":
                      "8081",
                  }
                : undefined,
            },
          },
        },
        tor: {
          name: "Tor",
          description:
            "Your own private Tor network for Monero and services like Moneroblock and P2Pool. You can share it with others or keep it to yourself.",
          checked: isTor,
          required: false,
          volumes: {
            "tor-keys": {},
          },
          code: {
            tor: {
              image: "goldy/tor-hidden-service:latest",
              container_name: "tor",
              restart: "unless-stopped",
              links: [
                "monerod",
                ...(p2PoolMode !== "none" ? ["p2pool"] : []),
                ...(isMoneroblock ? ["moneroblock"] : []),
                ...(isOnionMoneroBlockchainExplorer
                  ? ["onion-monero-blockchain-explorer"]
                  : []),
              ],
              environment: {
                MONEROD_TOR_SERVICE_HOSTS: "18089:monerod:18089",
                ...(p2PoolMode !== "none"
                  ? {
                      P2POOL_TOR_SERVICE_HOSTS: "3333:p2pool:3333",
                    }
                  : {}),
                ...(isMoneroblock
                  ? {
                      MONEROBLOCK_TOR_SERVICE_HOSTS: "31312:moneroblock:31312",
                    }
                  : {}),
                ...(isOnionMoneroBlockchainExplorer
                  ? {
                      MONERO_ONION_BLOCKCHAIN_EXPLORER_TOR_SERVICE_HOSTS:
                        "8081:onion-monero-blockchain-explorer:8081",
                    }
                  : {}),
              },
              volumes: ["tor-keys:/var/lib/tor/hidden_service/"],
            },
          },
        },
        watchtower: {
          name: "Watchtower",
          description:
            "Watchtower is a service that monitors running Docker and watches for newer images. If there is a new version available, watchtower will autoamtically restart the container with the newest image.",
          checked: isWatchtower,
          required: false,
          code: {
            watchtower: {
              image: "containrrr/watchtower:latest",
              container_name: "watchtower",
              restart: "unless-stopped",
              environment: {
                WATCHTOWER_CLEANUP: true,
                WATCHTOWER_POLL_INTERVAL: 3600,
              },
              volumes: ["/var/run/docker.sock:/var/run/docker.sock"],
            },
          },
        },
        monitoring: {
          name: "Monitoring",
          description:
            "Monitoring with Prometheus and Grafana: see your node stats visualized in graphs. See on a map where your peers are located.",
          checked: isMonitoring,
          required: false,
          volumes: {
            grafana: {},
            prometheus: {},
          },
          bash: `
# Download default Prometheus and Grafana configs/dashboards
mkdir -p monitoring/grafana/dashboards monitoring/grafana/provisioning/{dashboards,datasources} monitoring/prometheus 
wget -O monitoring/prometheus/config.yaml https://raw.githubusercontent.com/lalanza808/docker-monero-node/master/files/prometheus/config.yaml
wget -O monitoring/grafana/grafana.ini https://raw.githubusercontent.com/lalanza808/docker-monero-node/master/files/grafana/grafana.ini
wget -O monitoring/grafana/dashboards/node_stats.json https://raw.githubusercontent.com/lalanza808/docker-monero-node/master/files/grafana/dashboards/node_stats.json
wget -O monitoring/grafana/provisioning/dashboards/all.yaml https://raw.githubusercontent.com/lalanza808/docker-monero-node/master/files/grafana/provisioning/dashboards/all.yaml
wget -O monitoring/grafana/provisioning/datasources/all.yaml https://raw.githubusercontent.com/lalanza808/docker-monero-node/master/files/grafana/provisioning/datasources/all.yaml

# Optionally customize the Monitoring deployment with environment variables
cd monitoring
touch .env
echo GF_LOG_LEVEL=info >> .env
echo GF_USERS_ALLOW_SIGN_UP=false >> .env
echo GF_USERS_ALLOW_ORG_CREATE=false >> .env
echo GF_AUTH_ANONYMOUS_ENABLED=true >> .env
echo GF_AUTH_BASIC_ENABLED=false >> .env
echo GF_AUTH_DISABLE_LOGIN_FORM=true >> .env
echo GF_SECURITY_ADMIN_PASSWORD=admin >> .env
echo GF_SECURITY_ADMIN_USER=admin >> .env
# nano .env
`,
          code: {
            prometheus: {
              image: "prom/prometheus:latest",
              container_name: "prometheus",
              restart: "unless-stopped",
              command: [
                "--config.file=/etc/prometheus/config.yaml",
                "--storage.tsdb.path=/prometheus",
                "--storage.tsdb.retention.time=${PROM_RETENTION:-360d}",
              ],
              volumes: [
                "prometheus:/prometheus",
                "./monitoring/prometheus/config.yaml:/etc/prometheus/config.yaml:ro",
              ],
            },
            exporter: {
              image: "lalanza808/monerod_exporter:latest",
              container_name: "monerod_exporter",
              restart: "unless-stopped",
              command: "--monero-addr=http://monerod:18083",
            },
            grafana: {
              image: "grafana/grafana:latest",
              container_name: "grafana",
              user: "${UID}:${GID}",
              command: "-config=/etc/grafana/grafana.ini",
              restart: "unless-stopped",
              ports: ["127.0.0.1:${GF_PORT:-3000}:3000"],
              volumes: [
                "grafana:/var/lib/grafana",
                "./monitoring/grafana/grafana.ini:/etc/grafana/grafana.ini:ro",
                "./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro",
                "./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro",
              ],
              labels: isTraefik
                ? {
                    "traefik.enable": "true",
                    "traefik.http.routers.monitoring.rule": `Host(\`${grafanaDomain}\`)`,
                    "traefik.http.routers.monitoring.entrypoints": "websecure",
                    "traefik.http.routers.monitoring.tls.certresolver":
                      "monerosuite",
                    "traefik.http.services.monitoring.loadbalancer.server.port":
                      "31312",
                  }
                : undefined,
              environment: {
                HOSTNAME: "grafana",
                GF_SERVER_ROOT_URL: isTraefik
                  ? `https://${grafanaDomain}`
                  : `http://${grafanaDomain}`,
                GF_ANALYTICS_REPORTING_ENABLED: "false",
                GF_ANALYTICS_CHECK_FOR_UPDATES: "false",
                GF_LOG_LEVEL: "${GF_LOG_LEVEL:-error}",
                GF_USERS_ALLOW_SIGN_UP: "${GF_USERS_ALLOW_SIGN_UP:-false}",
                GF_USERS_ALLOW_ORG_CREATE:
                  "${GF_USERS_ALLOW_ORG_CREATE:-false}",
                GF_AUTH_ANONYMOUS_ENABLED: "${GF_AUTH_ANONYMOUS_ENABLED:-true}",
                GF_AUTH_BASIC_ENABLED: "${GF_AUTH_BASIC_ENABLED:-false}",
                GF_AUTH_DISABLE_LOGIN_FORM:
                  "${GF_AUTH_DISABLE_LOGIN_FORM:-true}",
                GF_SECURITY_ADMIN_PASSWORD:
                  "${GF_SECURITY_ADMIN_PASSWORD:-admin}",
                GF_SECURITY_ADMIN_USER: "${GF_SECURITY_ADMIN_USER:-admin}",
              },
            },
          },
        },
        autoheal: {
          name: "Autoheal",
          description:
            "Autoheal is a simple Docker container that will monitor and restart unhealthy docker containers.",
          checked: isAutoheal,
          required: false,
          code: {
            autoheal: {
              image: "willfarrell/autoheal:latest",
              container_name: "autoheal",
              restart: "unless-stopped",
              environment: {
                AUTOHEAL_CONTAINER_LABEL: "all",
              },
              volumes: ["/var/run/docker.sock:/var/run/docker.sock"],
            },
          },
        },
        xmrig: {
          name: "XMRig",
          description:
            "XMRig is a high performance Monero (XMR) CPU miner, with official support for Windows.",
          checked: isXmrig,
          required: false,
          code: {
            xmrig: {
              image: "minerboy/xmrig:latest",
              container_name: "xmrig",
              restart: "unless-stopped",
              cap_add: ["SYS_ADMIN", "SYS_RAWIO"],
              devices: ["/dev/cpu", "/dev/mem"],
              volumes: ["/lib/modules:/lib/modules"],
              command: ["-o p2pool:3333"],
            },
          },
        },
        traefik: {
          name: "Traefik",
          description:
            "Traefik is a modern HTTP reverse proxy and load balancer that makes deploying microservices easy.",
          checked: isTraefik,
          required: false,
          volumes: {
            letsencrypt: {},
          },
          code: {
            traefik: {
              image: "traefik:latest",
              container_name: "traefik",
              restart: "unless-stopped",
              command: [
                "--providers.docker=true",
                "--providers.docker.exposedbydefault=false",
                "--entrypoints.web.address=:80",
                "--entrypoints.websecure.address=:443",
                "--certificatesresolvers.monerosuite.acme.tlschallenge=true",
                "--certificatesresolvers.monerosuite.acme.storage=/letsencrypt/acme.json",
              ],
              ports: ["80:80", "443:443"],
              volumes: [
                "/var/run/docker.sock:/var/run/docker.sock",
                "letsencrypt:/letsencrypt",
              ],
            },
          },
          bash: "\n# Allow http and https ports\nsudo ufw allow 80/tcp 443/tcp\n",
        },
      } as ServiceMap),
    [
      isMoneroPublicNode,
      isPrunedNode,
      p2PoolMode,
      p2PoolPayoutAddress,
      p2PoolMiningThreads,
      isXmrig,
      isMoneroblock,
      isMoneroblockLogging,
      isOnionMoneroBlockchainExplorer,
      grafanaDomain,
      isTor,
      isWatchtower,
      isMonitoring,
      isAutoheal,
      isTraefik,
      moneroNodeDomain,
      moneroBlockDomain,
      onionMoneroBlockchainExplorerDomain,
    ]
  );

  return {
    services,
    stateFunctions: {
      isMoneroPublicNode,
      setIsMoneroPublicNode,
      isPrunedNode,
      setIsPrunedNode,
      p2PoolMode,
      setP2PoolMode,
      p2PoolPayoutAddress,
      setP2PoolPayoutAddress,
      p2PoolMiningThreads,
      setP2PoolMiningThreads,
      isXmrig,
      setIsXmrig,
      isMoneroblock,
      setIsMoneroblock,
      isMoneroblockLogging,
      setIsMoneroblockLogging,
      isOnionMoneroBlockchainExplorer,
      setIsOnionMoneroBlockchainExplorer,
      isTor,
      setIsTor,
      isWatchtower,
      setIsWatchtower,
      isMonitoring,
      setIsMonitoring,
      grafanaDomain,
      setGrafanaDomain,
      isAutoheal,
      setIsAutoheal,
      isTraefik,
      setIsTraefik,
      moneroNodeDomain,
      setMoneroNodeDomain,
      moneroBlockDomain,
      setMoneroBlockDomain,
      onionMoneroBlockchainExplorerDomain,
      setOnionMoneroBlockchainExplorerDomain,
    },
  };
};
