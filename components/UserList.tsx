import { Switch } from "@headlessui/react";
import { UserCircleIcon, TrashIcon } from "@heroicons/react/24/solid";
import { TailSpin } from "react-loader-spinner";
import { toast } from "react-toastify";
import Link from "next/link";
import { isAdmin } from "../lib/utils";
import { useState } from "react";
import { useUsers, persistUserRole } from "../lib/users";
import { UserRole } from "@prisma/client";
import { classNames } from "../lib/utils";

export default function UserList() {
  const { users, mutateUsers } = useUsers();
  const [loading, setLoading] = useState(false);

  const toggleRole = async (user) => {
    setLoading(true);
    setTimeout(async () => {
      const newUserRole =
        user.role === UserRole.ADMIN ? UserRole.PUBLIC : UserRole.ADMIN;
      const data = {
        id: user.id,
        role: newUserRole,
      };
      JSON.parse(JSON.stringify(user));

      await persistUserRole(data);
      mutateUsers();
      setLoading(false);
      toast("Your role has changed 🎉");
    }, 500);
  };

  // const deleteForm = async (form, formIdx) => {
  //   try {
  //     await fetch(`/api/users/${form.id}`, {
  //       method: "DELETE",
  //     });
  //     // remove locally
  //     const updatedForms = [...forms];
  //     updatedForms.splice(formIdx, 1);
  //     mutateForms(updatedForms);
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

  return (
    <>
      <div className="h-full px-6 py-8">
        {users && (
          <ul className="flex flex-col">
            {users
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((user, userIdx) => (
                <li
                  key={userIdx}
                  className="flex justify-between items-center border-y border-slate-100 py-2"
                >
                  <div className="w-5/6 flex items-center ">
                    <UserCircleIcon className="w-12 text-slate-500" />
                    <div className="w-1/5 mx-3 flex justify-between items-center text-lg line-clamp-3 text-slate-900">
                      <p className="w-1/2 font-light">{user.firstname}</p>{" "}
                      <p className="w-1/2 font-bold">{user.lastname}</p>
                    </div>
                    <div className="flex items-center justify-between  w-2/3 text-slate-900">
                      <div className="w-1/6 ">{user.gender}</div>
                      <div className="w-1/2">{user.email}</div>
                      <div className=" w-1/2 text-left ml-4">{user.phone}</div>
                      <div className=" w-1/2 text-left ml-4">{user.whatsapp}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-1/6">
                    <Switch.Group
                      as="div"
                      className="flex items-center justify-between w-1/3"
                    >
                      <Switch.Label
                        as="span"
                        className={
                          user.role === UserRole.ADMIN
                            ? "text-sm font-bold text-red-600 mr-3"
                            : "text-sm font-bold text-gray-900 mr-3"
                        }
                        passive={true}
                      >
                        {user.role === UserRole.ADMIN
                          ? UserRole.ADMIN
                          : UserRole.PUBLIC}
                      </Switch.Label>
                      {loading ? (
                        <TailSpin color="#1f2937" height={30} width={30} />
                      ) : (
                        <Switch
                          checked={isAdmin(user)}
                          onChange={() => toggleRole(user)}
                          className={classNames(
                            user.role === UserRole.ADMIN
                              ? "bg-red-600 transition-colors ease-in-out duration-200"
                              : "bg-gray-200",
                            "relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={classNames(
                              user.role === UserRole.ADMIN
                                ? "translate-x-5"
                                : "translate-x-0",
                              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"
                            )}
                          />
                        </Switch>
                      )}
                    </Switch.Group>
                    <Link href="#">
                      <a className="text-xs flex justify-center items-center border border-red">
                        <TrashIcon className="w-6 h-6 text-ui-gray-dark hover:text-red-600" />
                      </a>
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}
