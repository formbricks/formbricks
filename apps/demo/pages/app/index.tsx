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
      <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Laborum doloremque saepe fugit tempore aliquid eum, architecto alias dolores beatae unde reiciendis cumque nobis quidem quae placeat nesciunt veritatis enim magni.
      Sapiente consectetur amet eum quibusdam at esse quos nam officia molestiae atque illo neque ipsa aliquid corrupti dicta, cum aperiam, quam placeat! Assumenda, similique sequi molestias necessitatibus atque at nisi!
      Consectetur quam voluptas eos. Voluptatibus fuga numquam eum temporibus asperiores at ut pariatur? Esse exercitationem quo voluptate. Magni numquam ad excepturi voluptatum rerum expedita dolores aliquid exercitationem, suscipit, ullam laboriosam.
      Voluptatibus delectus maxime nostrum exercitationem pariatur consequatur architecto quaerat obcaecati quod distinctio, ipsam quos temporibus! Asperiores beatae facere eveniet. Earum minima odio, voluptates sit quia quae saepe ex voluptatum vitae.
      Ducimus, voluptatum corrupti mollitia possimus eos et delectus amet dolorum id consectetur, est vel. Cum architecto repellendus, esse minus repudiandae eveniet aperiam odit voluptatum provident. Non quo quidem exercitationem illo.
      Deleniti id iusto nisi? Debitis perferendis ipsa porro dicta culpa alias omnis pariatur nisi a soluta, qui sequi adipisci architecto sunt dignissimos commodi. Ut, facilis quos consequatur delectus esse dolor?
      Molestias aliquid soluta voluptatum, sit alias eum, aperiam animi, exercitationem maxime quos ex id quidem enim ad fugit? Iure eveniet quia nemo odit, fugiat commodi praesentium sed sapiente perspiciatis laudantium.
      Eligendi error voluptatum rerum enim? Maxime doloribus sit minus ullam sapiente nostrum, repellat odio ipsum modi adipisci quibusdam fugiat ea sint ratione natus assumenda repellendus impedit? Beatae repudiandae molestiae sunt.
      Cum tenetur quaerat explicabo libero praesentium sequi obcaecati voluptate ab adipisci delectus nulla iure, dolore nostrum eos ad aspernatur fuga consequuntur, odit aliquam velit voluptatibus aliquid vel maiores! Eos, amet.
      Illo atque ipsa voluptate labore, voluptatibus quis quas nulla distinctio veniam ratione quidem porro consequatur, perferendis nobis natus doloremque nesciunt. Ab adipisci magni facere error quia laudantium enim cum odit.
      Quaerat explicabo corrupti rem nostrum molestias velit maiores sint ea debitis itaque libero fuga ipsum tenetur, qui at eum doloremque eos beatae? Sapiente repellendus repudiandae aliquid, doloremque pariatur officiis omnis?
      Quod molestias tenetur nihil ex mollitia iusto ipsum iure blanditiis dolores praesentium sunt assumenda, ipsa esse culpa reprehenderit delectus deserunt fuga quae accusantium excepturi officiis. Hic dolorem libero quo expedita?
      Error vero est dolore fugiat, asperiores laboriosam assumenda veniam animi nulla molestiae adipisci consectetur atque. Numquam eligendi adipisci odit cupiditate tempore. Cupiditate reprehenderit consectetur ipsam, quis natus perspiciatis nostrum porro.
      Optio ullam eaque cupiditate debitis accusamus dolorum voluptatum ratione expedita illo officia dolore adipisci corrupti natus officiis aliquam labore voluptates dolorem, modi iure iste earum, consequatur in! Ipsam, maiores laudantium.
      Earum quo quasi ipsa tempore facilis nihil, perferendis asperiores natus facere placeat reprehenderit saepe amet cum ratione adipisci porro harum quia ea, magni est corporis magnam unde! Magni, ipsam asperiores?
      Minus quidem expedita odio earum. Aliquam consectetur sed assumenda, dolorum error est earum, a natus, repellendus necessitatibus animi delectus sit numquam quidem quo? Perferendis similique blanditiis vel iste, ullam maiores?
      Ipsum assumenda dicta accusamus ad tempore minus impedit, numquam libero vel eligendi! Itaque corporis tempora debitis temporibus molestiae sunt autem obcaecati facere voluptas. Odio, et facere fugiat aliquid eum ex!
      Similique nihil, excepturi consequuntur quam fugiat ea? Rerum facere commodi voluptas corporis error enim nobis at minima repellendus libero quod sed doloribus pariatur alias, voluptatibus numquam. In dolore incidunt illo.
      Quaerat consectetur corrupti eligendi natus ducimus vero officia eos. Repudiandae nam veniam sint dolor perferendis quisquam tempora. Nam quos mollitia laboriosam vitae doloribus, corporis dicta deleniti sapiente? Nobis, illum eos.
      Vel repellendus, aut, ex accusantium fuga voluptatibus est soluta nemo saepe temporibus quam delectus! Odit tempora repudiandae hic minus magnam eaque, reprehenderit laboriosam numquam cum nesciunt quibusdam facilis voluptatibus quae?
      Eum accusamus ipsum laudantium. Consequatur suscipit eos voluptate ducimus qui porro rem exercitationem cumque animi dolor repellendus eligendi ratione, odio obcaecati alias dignissimos neque asperiores officiis inventore. Nulla, autem repellat!
      Explicabo ipsum necessitatibus quidem repellat, rem quia assumenda sapiente optio cupiditate sed adipisci quis officiis exercitationem veniam provident at dolore qui veritatis labore, expedita fugiat consequuntur suscipit? Praesentium, reprehenderit maxime.
      A quae obcaecati laborum nihil? Vel animi numquam provident ut quisquam eligendi adipisci facere molestiae aspernatur, totam fugit ipsum sit dicta voluptatum, tenetur, repudiandae sed fuga earum accusantium. Officiis, iure.
      Quo ad culpa dicta fugit nisi! Impedit expedita velit similique delectus ab minima ut assumenda, reiciendis quo voluptatibus? Necessitatibus, iure odio amet voluptatem magni hic ipsam perferendis quo quos consectetur!
      Laborum error voluptate saepe libero tenetur illo accusantium id alias quis ipsam, placeat rerum, officia nostrum molestias dicta consequatur inventore, nihil aliquid recusandae vero? Sapiente eius autem quasi sunt quod.
      Molestias iure facere, culpa esse nam est labore perspiciatis magni consequuntur veritatis vitae. Veritatis accusamus molestias ex. Quae suscipit ullam, non temporibus eligendi officiis, quia, odit sequi est qui repellendus!
      Deleniti molestias, officiis fugit rerum inventore similique soluta officia, nobis eius natus saepe consequatur beatae eum mollitia. Iste dolore illum, unde dignissimos ab veritatis pariatur sit. Neque velit molestiae eaque.
      Cum veritatis modi praesentium, deserunt blanditiis enim necessitatibus, placeat ullam nisi minus atque ea commodi, aliquam corrupti aspernatur suscipit quaerat. Natus eveniet minima consequatur cupiditate eaque quidem. Odio, nulla labore.
      Laboriosam dicta consequatur deserunt veniam nesciunt architecto sapiente hic accusamus voluptatem. Voluptas, omnis ratione, accusantium rem aperiam, ullam eum iste ea repellendus molestias numquam provident amet rerum nisi obcaecati ad!
      Labore corporis animi hic? Tempore tempora veritatis laudantium facilis temporibus. Illo, doloremque quisquam? Error natus nostrum aliquid cupiditate aut? Maxime, quos sunt assumenda molestias nam ipsum! Iste ipsum dolorem veniam!
      Iusto optio hic, debitis, nemo est ducimus ipsam eligendi nisi eos eius a odit perspiciatis. Rem nemo libero officia fugit doloremque velit commodi, beatae sequi, ipsa consequuntur quo ipsum labore?
      Non magnam in hic mollitia magni nisi, harum similique qui vel labore. Esse eligendi facere vitae officiis asperiores velit? Maiores corrupti nemo, nobis hic iste perspiciatis! Aliquid cupiditate eum sapiente?
      Distinctio sequi enim, fuga, delectus beatae sint, voluptatem alias in deleniti sunt libero corporis amet nam praesentium unde dolore modi veritatis consequuntur dolorem! Optio, deleniti laboriosam? Magnam libero perspiciatis sed?
      Quisquam reiciendis aut cumque minus expedita doloremque eos consectetur sunt molestias iste necessitatibus, ut cupiditate deserunt provident enim modi esse velit autem accusantium sequi optio incidunt distinctio atque! Illum, voluptas.
      Placeat sed magni suscipit id consectetur temporibus debitis totam ipsam culpa ducimus odio laborum facere facilis aliquid, praesentium quibusdam omnis repudiandae similique veritatis itaque? Veniam velit explicabo iusto eaque quisquam.
      Quae fuga totam dolore provident ipsam fugit ipsa deleniti impedit molestias a facilis earum reiciendis tempora sint repellendus, odit modi. Obcaecati alias laudantium dignissimos explicabo deserunt eveniet ea ducimus natus?
      Reiciendis voluptatibus quibusdam rerum accusamus officia dicta ex aut earum quia, in aliquid, iure debitis delectus repellendus! Omnis alias, cumque dolor blanditiis cum, voluptatibus voluptatem nemo ipsam earum, facere eius!
      Animi, soluta labore nobis enim illo necessitatibus reiciendis aliquid quos ex, quibusdam, quia quaerat iure sunt consectetur id. Eaque esse neque magnam ab iusto! Vero quisquam voluptatibus culpa impedit qui.
      Nam, magni itaque excepturi ratione velit ut. Ut facilis tempora at fugiat dolor velit excepturi dolorum, ea dolores minima accusamus quos expedita deserunt facere explicabo! Quasi enim assumenda quo amet.
      Doloribus illo rerum est assumenda impedit cum aliquam modi fugiat? Explicabo beatae voluptas enim quod natus harum autem atque quisquam corporis? Rem soluta non quas fugiat temporibus quo repellat quae.
      Animi voluptates sunt quae dolorem aspernatur! Ex pariatur natus mollitia maiores deserunt deleniti quis esse officiis, consectetur, ipsum porro animi laboriosam ullam qui provident veritatis, fugit minus nemo aperiam libero!
      Natus veritatis recusandae ea rem sed fugit commodi, ad voluptate? Qui deleniti laudantium, perferendis eaque, magni eligendi rem ea delectus minus iure praesentium, amet incidunt in accusantium sed nemo dolor.
      Tempora totam molestiae odio possimus ex delectus fugit tempore unde facere placeat molestias quaerat culpa quisquam provident sint autem eum, beatae recusandae assumenda veritatis iusto error saepe architecto rerum. Ipsum.
      Expedita ex laborum maxime commodi reprehenderit, deleniti iste? Voluptatibus cumque provident, at rerum blanditiis, reiciendis consequuntur nihil sapiente labore repudiandae aperiam aut consectetur voluptas harum quasi iure. Hic, est animi!
      Maxime quisquam mollitia laboriosam eos nesciunt, ea blanditiis eveniet vel sequi quae dolor voluptas omnis vero consequuntur? Asperiores porro et, autem quos voluptatibus, illo atque, eaque repellat officiis in sapiente?
      Doloribus ex iure porro blanditiis atque! Aliquam ipsum, velit natus cupiditate quibusdam vel ratione modi quasi laudantium voluptatem aliquid? Perspiciatis, doloremque facilis similique dicta error rem pariatur quod soluta temporibus.
      Accusamus quis eveniet voluptatem voluptas. Error nesciunt sit cum, pariatur quo sequi quas ipsa nam, numquam amet provident neque. Mollitia ad saepe ducimus nemo, ipsa iure error reprehenderit rem ea?
      Inventore fuga incidunt molestiae commodi quo facere aliquid doloremque eveniet, itaque minima tenetur, rerum corporis ut consectetur! Eaque ad maxime optio rerum enim? Molestiae officia, neque corrupti animi dolore dicta.
      Saepe asperiores dignissimos quasi beatae eveniet. Eveniet voluptate, porro laborum voluptatem natus, laudantium possimus eius consequuntur veritatis error est a accusantium eligendi labore tempora. Voluptas eum voluptates illo odit accusamus!
      Recusandae labore assumenda rerum dolorem quidem enim natus, doloribus optio at ipsa voluptatum. Aspernatur voluptatum aperiam, magnam rem animi cupiditate quos harum cum consectetur enim voluptatem nemo eos dolorum ut.
      Repudiandae praesentium labore veritatis itaque, assumenda magni unde cupiditate, repellat est ab ea ratione expedita! Et asperiores odio fugiat enim odit suscipit quod quis nulla. Qui nostrum modi ratione delectus?
      Rerum nostrum molestiae deleniti, eligendi quae voluptates placeat animi mollitia accusamus, nihil vero, quis officia ab quasi itaque velit ullam obcaecati blanditiis. Similique vel aut magnam labore? Nam, magni dignissimos!
      Commodi praesentium quis quas sint. Eligendi ducimus rem unde commodi odio quaerat, repudiandae quo sint beatae! Reprehenderit iure vitae, hic iste debitis, non, nesciunt facere quos repudiandae earum amet quasi.
      Error facere eaque architecto magni, ut voluptate id assumenda, fugiat amet hic corrupti modi harum voluptates iusto vero dicta praesentium pariatur debitis quis illum quaerat reprehenderit doloribus! Commodi, quisquam consequuntur.
      Iste aspernatur voluptas consequuntur alias cupiditate magnam itaque! Dicta, minima dignissimos? Dicta minus ducimus, in, sunt cumque quasi ipsam ratione reprehenderit voluptates repellendus autem beatae? Laboriosam a quasi nemo totam.
      Error rem eligendi nisi similique porro. Voluptates illum quis nulla aliquid deleniti quod numquam mollitia facilis eligendi cumque assumenda, nihil velit laboriosam commodi. Excepturi nemo inventore esse quisquam vitae quaerat!
      Rem dolore voluptatum repellendus optio laborum incidunt autem similique nulla magni corrupti fuga consequatur temporibus cum quis itaque corporis ab qui, rerum dolor repellat assumenda! Perferendis minima dignissimos velit. Quis!
      Consequuntur sequi nisi modi ab assumenda libero odit officiis vel numquam adipisci natus blanditiis, dolores doloribus ad placeat, sapiente deserunt quia, aut quod laborum! Similique culpa repellat quis et nisi.
      Quibusdam nobis sunt maxime dicta quod incidunt cupiditate quisquam aliquam voluptatum at debitis nulla magnam, ipsum, officiis suscipit exercitationem quas nam modi inventore quo doloremque perferendis dolorem saepe consequuntur. Voluptatibus.
      Expedita omnis maiores illum, sint doloribus error hic voluptatibus fuga iusto, sequi rem fugiat facere soluta natus magni nesciunt aspernatur libero! Ducimus inventore alias, doloribus ratione illum asperiores culpa recusandae.
      Corrupti dolor, voluptatem eos dicta modi unde temporibus reprehenderit, pariatur minima mollitia praesentium, iusto tenetur? Exercitationem aliquid necessitatibus nesciunt delectus ullam eos ipsam itaque praesentium minima, dolorum assumenda cupiditate omnis!
      Veniam iusto repudiandae doloremque ut est, quos illum facere neque iure nobis? Dolore magni omnis autem nihil nemo porro. Dicta impedit placeat hic dignissimos nam veniam sequi. Inventore, modi praesentium?
      Exercitationem aut ad debitis placeat quae mollitia, iure facere molestias ab cupiditate nemo expedita voluptatum dignissimos soluta quia, dolore sit cum rem repellendus, maxime necessitatibus impedit quod aliquam. Vel, illum.
      Nam numquam unde recusandae, porro cumque architecto saepe ut explicabo laborum dolorum magni quisquam enim. Eaque, odio pariatur distinctio laboriosam tempora vel non culpa quia nisi ut, quisquam, quae deserunt!
      Id aperiam exercitationem praesentium aliquam facilis amet suscipit nesciunt quasi consectetur debitis cum veniam molestiae ut eveniet architecto voluptatum itaque libero, consequuntur corporis fuga aliquid reprehenderit veritatis delectus! Cumque, deserunt.
      Dolor dignissimos error libero nostrum voluptatem hic optio maiores, culpa similique aperiam odit est sapiente magni quos illo perspiciatis labore recusandae, officia omnis. Quisquam blanditiis enim id itaque deleniti consectetur?
      Dolore nulla dolores accusantium voluptas alias debitis veritatis nobis eaque qui voluptatum omnis eum reiciendis incidunt pariatur dolorem eius ipsa atque, beatae unde tenetur praesentium corrupti aut quia sunt? Quas.
      Dignissimos nobis minima vitae voluptas! Tenetur, aperiam impedit cupiditate assumenda id non ut deserunt, illo praesentium doloremque iste autem eveniet recusandae dicta odit facere accusamus! Suscipit quis maiores autem voluptatibus!
      Impedit, ullam fugiat? Optio, voluptates rerum dolorem accusamus libero ipsam porro nemo voluptatibus minima eos perspiciatis assumenda dicta harum at fuga? Omnis aperiam, obcaecati veritatis quas vitae earum. Ipsam, odio?
      Provident nam dicta vitae unde sed debitis velit, accusantium, similique quia eos consequatur sit necessitatibus voluptas laborum deserunt? Voluptas delectus optio quas, dicta suscipit pariatur non magni libero ab. Ullam.</div>
    </div>
  );
}
