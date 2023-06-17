import fbsetup from "../../public/fb-setup.png";
import formbricks from "@formbricks/js";
import Image from "next/image";
import { LogsContainer } from "../../components/ConsoleFeed";

export default function AppPage({}) {
  return (
    <div className="px-12 py-6">
      <div>
        <h1 className="text-2xl font-bold">Formbricks In-product Survey Demo App</h1>
        <p className="text-slate-700">
          This app helps you test your in-app surveys. You can create an test user actions, create and update
          user attributes, etc.
        </p>
      </div>
      <div className="my-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Setup .env</h3>
            <p className="text-slate-700">
              Copy the environment ID of your Formbricks app to the env variable in demo/.env
            </p>
            <Image src={fbsetup} alt="fb setup" className="mt-4 rounded" priority />
          </div>
          <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Console</h3>
            <p className="text-slate-700">You can also open your browser console to logs:</p>
            <div className="max-h-[40vh] overflow-y-auto py-4">
              <LogsContainer />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <div className="col-span-3 rounded-lg border border-slate-300 bg-slate-100 p-6">
            <h3 className="text-lg font-semibold">Reset person / pull data from Formbricks app</h3>
            <p className="text-slate-700">
              On formbricks.logout() a few things happen: <strong>New person is created</strong> and{" "}
              <strong>surveys & no-code actions are pulled from Formbricks:</strong>.
            </p>
            <button
              className="my-4 rounded-lg bg-slate-500 px-6 py-3 text-white hover:bg-slate-700"
              onClick={() => {
                formbricks.logout();
              }}>
              Logout
            </button>
            <p className="text-xs text-slate-700">
              If you made a change in Formbricks app and it does not seem to work, hit &apos;Logout&apos; and
              try again.
            </p>
          </div>

          <div className="p-6">
            <div>
              <button
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700"
                onClick={() => {
                  formbricks.track("Code Action");
                }}>
                Code Action
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sends a{" "}
                <a href="https://formbricks.com/docs/actions/code" className="underline" target="_blank">
                  Code Action
                </a>{" "}
                to the Formbricks API called &apos;Code Action&apos;. You will find it in the Actions Tab.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                No-Code Action
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sends a{" "}
                <a href="https://formbricks.com/docs/actions/no-code" className="underline" target="_blank">
                  No Code Action
                </a>{" "}
                as long as you created it beforehand in the Formbricks App.{" "}
                <a href="https://formbricks.com/docs/actions/no-code" target="_blank" className="underline">
                  Here are instructions on how to do it.
                </a>
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setAttribute("Plan", "Free");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Plan to &apos;Free&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  className="underline">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Free&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setAttribute("Plan", "Paid");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Plan to &apos;Paid&apos;
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/custom-attributes"
                  target="_blank"
                  className="underline">
                  attribute
                </a>{" "}
                &apos;Plan&apos; to &apos;Paid&apos;. If the attribute does not exist, it creates it.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setEmail("test@web.com");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set Email
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets the{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  className="underline">
                  user email
                </a>{" "}
                &apos;test@web.com&apos;
              </p>
            </div>
          </div>
          <div className="p-6">
            <div>
              <button
                onClick={() => {
                  formbricks.setUserId("THIS-IS-A-VERY-LONG-USER-ID-FOR-TESTING");
                }}
                className="mb-4 rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
                Set User ID
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-700">
                This button sets an external{" "}
                <a
                  href="https://formbricks.com/docs/attributes/identify-users"
                  target="_blank"
                  className="underline">
                  user ID
                </a>{" "}
                to &apos;THIS-IS-A-VERY-LONG-USER-ID-FOR-TESTING&apos;
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum illo doloribus quos rem dolore accusantium, sequi, libero, a quasi blanditiis minus ipsum? Perspiciatis ab, id alias assumenda commodi sunt incidunt!
      Repellat, atque cum cumque in amet accusamus sed adipisci iusto beatae rerum suscipit fuga eos assumenda consectetur, mollitia et nostrum veritatis dolorum? Minima doloribus inventore omnis blanditiis natus repellat dolores.
      Porro vel enim esse adipisci temporibus fuga soluta, nemo, perferendis explicabo quo nesciunt rem cumque velit ipsam incidunt voluptatum maxime culpa ullam, tempora ut. Illo explicabo impedit ab provident dicta?
      Quo et illum quos eaque totam. Deleniti quaerat quis, similique ullam ipsum mollitia minima quae eos ex, optio odit placeat consequuntur voluptates a, accusantium voluptatum deserunt autem modi eaque. Ab!
      Officia eum expedita provident corrupti hic quos aut, reiciendis, amet obcaecati placeat similique ea dolore repudiandae quas mollitia iusto ipsum iure sapiente tempora, consequatur suscipit quasi ad! Doloribus, tempora in!
      Ex odio minima quia aperiam porro accusamus ducimus velit eos, distinctio asperiores quas repellat? Autem, voluptatibus et. Eligendi autem illo assumenda cum distinctio. Molestias magnam dolore, asperiores odio ratione non.
      Officiis, reiciendis magni mollitia, delectus possimus laboriosam iste molestias impedit totam consequatur deleniti. Nihil mollitia rerum nemo ducimus provident vitae iusto dolorum molestias ipsa. Harum eius aperiam fuga molestias sequi?
      Harum repellat temporibus quaerat maxime possimus voluptates iure illo id libero incidunt ad rem ipsam molestiae animi, natus, tempora iusto placeat illum in nam, odio ut a. Nemo, magnam id.
      Aliquam asperiores nihil quia magnam pariatur libero modi alias adipisci, iste ab quam quidem corrupti illo assumenda placeat? Hic incidunt eum, odit est commodi dicta consectetur suscipit maiores doloremque dolores?
      Commodi voluptatum porro atque vitae molestiae laudantium nulla cum aliquid ullam distinctio? Quibusdam, aliquid adipisci? Obcaecati molestiae, a ad, harum nostrum quos sunt dolorem non deleniti magni sit voluptas accusamus?
      Est eligendi fugiat unde nesciunt, porro ex harum reprehenderit excepturi, sint, ullam ut veritatis quasi. Earum, quo. Hic aperiam, magni architecto sapiente iste porro quidem? Molestias praesentium vel sed nobis.
      Cum obcaecati dolorum eos velit, nesciunt porro quasi vitae non, nostrum natus numquam beatae distinctio. Debitis quidem, nisi quos laboriosam nam, quaerat aut nesciunt, blanditiis id distinctio qui velit ipsam.
      Voluptatum aspernatur perspiciatis nesciunt enim velit voluptatem sapiente officia aut ea fugiat ad distinctio omnis ducimus ratione, earum error debitis cupiditate a quia repellendus? Veritatis alias possimus nesciunt nulla soluta?
      Maiores aperiam vitae voluptatem ab voluptates eos perspiciatis accusamus provident officiis saepe similique reprehenderit tenetur placeat atque ipsa, ducimus optio dignissimos. Vel fuga distinctio facere repudiandae, assumenda eum tempora sed!
      Dignissimos totam veritatis quaerat aperiam porro tempora expedita sint iure neque. Vel vero aut labore fugiat animi blanditiis totam? Modi, asperiores! Ducimus officia placeat quos, voluptates eos minima consequuntur ex.
      Ullam rem laboriosam reprehenderit iste dolorum repellendus quasi odio et ab veritatis, dolores, praesentium corporis libero soluta voluptatibus sed odit aut voluptas in autem molestias provident ea. Sed, corrupti perspiciatis.
      Nisi eos quasi, itaque dicta fugiat qui explicabo dolorem cupiditate possimus voluptatum placeat repellendus soluta. Voluptates eveniet, nihil perspiciatis nisi, culpa alias, deleniti iure dolores delectus ut praesentium voluptatem quod.
      Odio, non facilis quasi, ipsam voluptatem aliquid qui id, recusandae similique doloremque enim eos quo. Autem porro consequuntur aspernatur veritatis nobis mollitia at, quod obcaecati, adipisci dolorem voluptate commodi repellendus!
      Fugiat nesciunt aut iusto non hic? Ratione, laborum! Est numquam consequatur temporibus sapiente. Velit nobis, pariatur, fugiat dolores iusto mollitia explicabo quis porro animi quos temporibus et sunt consectetur officiis.
      Eaque quos ipsum nam explicabo dicta commodi! Numquam minus deserunt incidunt beatae aspernatur laudantium maiores, ratione atque et ab veniam, enim quidem reiciendis molestias. Id libero officiis voluptates dolores nisi.
      Eaque quae nemo voluptate consequuntur quidem nisi dolore ea ad, dolorum, id in hic soluta, voluptates voluptatem sint accusamus ipsa. Doloribus nostrum fugit dolorum temporibus sequi provident cum minima ullam.
      Nam, expedita cum sint iste illo nemo incidunt adipisci id nobis voluptates! Molestias exercitationem id voluptatum iste nihil numquam assumenda nulla, repellat ut ad, illum fugit dignissimos perspiciatis quaerat voluptate.
      Quas doloribus dolor nobis laboriosam possimus sequi fuga provident aliquid consectetur, maxime excepturi earum est, quibusdam assumenda corporis cumque quidem. Possimus cum id eum maxime in amet assumenda fugit officia.
      Quas, fugit culpa cupiditate modi incidunt non quo placeat laborum debitis perspiciatis voluptate possimus expedita, vitae cumque, velit temporibus rerum. Quo minus nostrum voluptatem, ipsam exercitationem repudiandae tempore possimus optio.
      Ad nam laborum distinctio eaque, consequuntur aliquid unde temporibus incidunt quos officia sed, molestias minus. Quam nisi esse iste officia optio ducimus nihil inventore voluptatum animi. Consequuntur nemo assumenda ad?
      Temporibus doloremque perspiciatis quis iste cupiditate omnis optio porro amet. Accusantium doloremque eaque id at suscipit praesentium nihil. Quos repellat voluptatum earum iure veniam itaque possimus ipsa quasi numquam alias.
      Consectetur assumenda quae, ullam laudantium voluptatem ea perferendis distinctio amet, ducimus quis nemo quod at voluptatum magnam eveniet enim. Pariatur illum numquam nesciunt voluptatum animi quaerat, maxime beatae sequi eum.
      Amet asperiores eum expedita iste deleniti placeat distinctio magnam porro minima ad tenetur dolor maiores, aliquam ex facere dolore soluta dolorum maxime tempora deserunt. Reprehenderit iusto temporibus eum praesentium ipsa.
      Eius facere sapiente, vitae sit quis laudantium excepturi assumenda, ipsum totam omnis minus dolore veniam architecto qui reiciendis mollitia perferendis quo vel similique aliquam nemo aspernatur illum, odio ea? Consectetur.
      Animi facere eum architecto consequuntur dolorum! Deleniti adipisci architecto facere praesentium! Numquam doloremque obcaecati aperiam, unde iusto nam mollitia perferendis magni accusamus tempore perspiciatis deleniti, corporis quia repellendus sequi consequuntur!
      Saepe, ipsum accusantium in repellendus repellat explicabo vero quos, quis sapiente eveniet ducimus quas sequi aut pariatur laudantium magni deleniti atque soluta rerum culpa tenetur perferendis reiciendis ea? Voluptate, modi.
      In commodi cumque recusandae. Minus qui nesciunt ad dignissimos ullam consequatur quae deserunt saepe quia beatae ducimus velit quaerat dolores, obcaecati dolor at voluptas nihil enim adipisci officia assumenda itaque!
      Aliquam nihil ex, est ratione voluptate earum esse aspernatur? Suscipit laudantium rem accusantium nisi ipsa voluptatibus nesciunt porro provident officiis recusandae non, eaque, dolores quis adipisci placeat mollitia quidem in!
      Eum eos incidunt quidem. Quam adipisci similique voluptatem iste beatae ratione sint dolor cupiditate nostrum omnis rerum distinctio fugit itaque, aliquam deserunt ut. Maiores enim corporis assumenda cum dolore tempore?
      Ab pariatur excepturi et alias quae repellat doloremque nisi labore, quod tenetur? Adipisci rem illo recusandae accusantium repellat cupiditate blanditiis facere provident nisi neque eum, vitae maiores eius fugiat labore.
      Rem nostrum libero nisi sit. Architecto ipsam optio placeat, maxime et, sunt laboriosam, ut distinctio quaerat blanditiis ab quasi accusantium facilis doloribus. Dicta accusantium deleniti perferendis doloribus culpa, voluptate veritatis.
      Voluptatum magnam veritatis, voluptatem modi beatae quos quod officiis voluptas nulla cupiditate perspiciatis aliquam similique a quaerat nisi aspernatur labore officia, assumenda illo nostrum harum iste delectus maiores nesciunt! Alias?
      Non incidunt hic doloribus labore inventore quod libero sed aperiam quidem perspiciatis dicta nulla esse veritatis quaerat cum blanditiis unde sequi, dolorem vel aspernatur alias? Tenetur ullam aperiam voluptate cumque.
      Consectetur nemo laudantium molestias alias distinctio doloremque harum, odit accusamus, debitis illo rem repellat qui esse nisi cumque quisquam necessitatibus placeat nesciunt dicta minima quas expedita facere totam! Eum, labore.
      Ex ut error enim, aliquam quae eaque libero quidem veritatis laborum atque a delectus omnis provident ipsam minima doloremque similique vel dicta laboriosam. Perspiciatis excepturi at, perferendis nemo sit sunt.
      Similique velit id architecto aspernatur quis ex reprehenderit voluptate quam deserunt reiciendis? Similique veniam nihil maxime maiores iusto. Inventore in magni, laudantium similique fuga molestiae eaque minus est laborum obcaecati.
      Repellendus provident laudantium nisi quia quo, magni ab ipsam facilis! Voluptates, repellat rem, repudiandae minima vel deserunt saepe dignissimos dolore cum in eius totam ipsa est libero magni et exercitationem!
      Error necessitatibus cumque cum libero sed quibusdam optio nihil illo ad autem amet labore eum inventore est placeat rem, quod dicta qui vitae a? Ex expedita saepe suscipit placeat nobis.
      Iure impedit illo ratione quasi repellat accusamus, eaque iusto reprehenderit deserunt ea quisquam excepturi minima obcaecati modi necessitatibus pariatur! Consectetur tempora voluptatem neque doloremque laudantium delectus rem velit porro maiores.
      Magnam ut quibusdam facere doloribus porro? Voluptatem cumque, ipsa velit repellendus obcaecati voluptas ea, laboriosam perspiciatis quo voluptates explicabo! Consequuntur sequi consequatur doloribus autem maxime earum labore, quos tempore ipsum!
      Rerum veritatis minus cum neque dolor saepe deleniti eos eius, repellendus eveniet illum, odio quis dolorum in adipisci natus perferendis et ab quo consectetur. Beatae esse fugiat error molestiae quos!
      Laboriosam ipsam perferendis itaque aspernatur facilis dolor alias illum odit ducimus? Id voluptatibus, eveniet fugiat earum, dignissimos minima voluptate delectus maiores voluptas possimus sed. Velit rem debitis natus ullam repudiandae.
      Praesentium vero, quasi fugiat veniam nam id incidunt consequuntur saepe perspiciatis voluptas ab tempore ut reprehenderit earum numquam, voluptatum nulla ullam iure illum culpa facere minus. Omnis praesentium doloremque dolorum!
      Eum nihil nesciunt, voluptatum quam quod impedit pariatur corrupti quo atque, cupiditate aut accusamus totam labore maiores sint aspernatur doloremque eaque nam numquam praesentium quisquam explicabo quasi? Error, quia nemo.
      Laboriosam adipisci excepturi cupiditate odio nemo velit aut necessitatibus quae harum laudantium, doloribus numquam ullam ratione dolores laborum enim dolorem odit nisi, cum voluptatum incidunt veritatis ut distinctio. Laudantium, nemo?</div>
    </div>
  );
}
