interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  activitySource: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl === '/' ? '' : baseUrl;
};

const data: ISiteMetadataResult = {
  siteTitle: '阿崔 Running',
  siteUrl: 'https://github.com/bowen-acui/running-page',
  logo: `${getBasePath()}/images/avatar.png`,
  description: '阿崔的跑步记录、运动路线与训练统计',
  activitySource: '导入的运动记录',
  navLinks: [
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
  ],
};

export default data;
